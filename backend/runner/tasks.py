"""
Celery tasks for async code execution.
Django submits a task, Celery worker picks it up, runs Docker, saves results.
"""
from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=1)
def run_submission(self, submission_id: int):
    """
    Execute a submission asynchronously.
    Called after a Submission record is created.
    """
    from submissions.models import Submission, TestResult, UserExerciseProgress
    from .import_validator import validate_imports
    from .docker_runner import run_code

    try:
        submission = Submission.objects.select_related(
            'exercise', 'exercise__language', 'user'
        ).prefetch_related(
            'exercise__test_cases'
        ).get(id=submission_id)
    except Submission.DoesNotExist:
        logger.error(f'Submission {submission_id} not found')
        return

    submission.status = Submission.STATUS_RUNNING
    submission.save(update_fields=['status'])

    exercise = submission.exercise
    language = exercise.language

    # Step 1: Validate imports (fast, before Docker)
    forbidden = exercise.get_forbidden_imports()
    allowed = exercise.get_allowed_imports()
    is_valid, error_msg = validate_imports(
        language.slug, submission.code, forbidden, allowed
    )
    if not is_valid:
        submission.status = Submission.STATUS_ILLEGAL_IMPORT
        submission.compile_output = error_msg
        submission.completed_at = timezone.now()
        submission.save(update_fields=['status', 'compile_output', 'completed_at'])
        return

    # Step 2: Build test case list
    test_cases = [
        {
            'id': tc.id,
            'order': tc.order,
            'stdin': tc.stdin,
            'expected_output': tc.expected_output,
            'is_hidden': tc.is_hidden,
        }
        for tc in exercise.test_cases.all().order_by('order')
    ]

    if not test_cases:
        submission.status = Submission.STATUS_WRONG_ANSWER
        submission.compile_output = '⚠️  No test cases configured for this exercise.'
        submission.completed_at = timezone.now()
        submission.save(update_fields=['status', 'compile_output', 'completed_at'])
        return

    # Step 3: Run in Docker
    try:
            result = run_code(
                code=submission.code,
                language_slug=language.slug,
                docker_image=language.docker_image,
                test_cases=test_cases,
                timeout_seconds=language.timeout_seconds,
                memory_limit=language.memory_limit,
                main_file=exercise.main_file or None,
                submit_main_file=exercise.submit_main_file or None,
                student_filename=exercise.student_filename or None,
            )
    except Exception as e:
        logger.exception(f'Docker runner failed for submission {submission_id}')
        submission.status = Submission.STATUS_RUNTIME_ERROR
        submission.compile_output = f'Internal runner error: {str(e)}'
        submission.completed_at = timezone.now()
        submission.save(update_fields=['status', 'compile_output', 'completed_at'])
        return

    # Step 4: Save test results
    status_map = {
        'accepted': Submission.STATUS_ACCEPTED,
        'wrong_answer': Submission.STATUS_WRONG_ANSWER,
        'compile_error': Submission.STATUS_COMPILE_ERROR,
        'runtime_error': Submission.STATUS_RUNTIME_ERROR,
        'time_limit': Submission.STATUS_TIME_LIMIT,
    }

    submission.status = status_map.get(result.status, Submission.STATUS_WRONG_ANSWER)
    submission.compile_output = result.compile_output
    submission.completed_at = timezone.now()
    submission.save(update_fields=['status', 'compile_output', 'completed_at'])

    TestResult.objects.bulk_create([
        TestResult(
            submission=submission,
            test_case_id=r.test_case_id,
            passed=r.passed,
            actual_output=r.actual_output if not r.is_hidden else '',
            error_output=r.error_output,
            execution_time_ms=r.execution_time_ms,
        )
        for r in result.test_results
    ])

    # Step 5: Update user progress
    _update_progress(submission)

    # Step 6: Push result to student via WebSocket
    _push_result_to_websocket(submission)


def _update_progress(submission):
    from submissions.models import UserExerciseProgress
    from django.utils import timezone

    progress, _ = UserExerciseProgress.objects.get_or_create(
        user=submission.user,
        exercise=submission.exercise,
    )
    progress.attempts += 1
    progress.last_attempted = timezone.now()

    if submission.status == 'accepted' and not progress.passed:
        progress.passed = True
        progress.passed_at = timezone.now()
        progress.best_submission = submission
        # Award XP
        submission.user.total_xp += submission.exercise.xp_reward
        submission.user.recalculate_level()
        submission.user.save(update_fields=['total_xp', 'level'])

    progress.save()


def _push_result_to_websocket(submission):
    """Push the completed submission result to the student's WebSocket connection."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from submissions.serializers import SubmissionSerializer

    channel_layer = get_channel_layer()
    group_name = f'submission_{submission.id}'

    # Re-fetch with test_results for serialization
    from submissions.models import Submission
    submission = Submission.objects.prefetch_related(
        'test_results__test_case'
    ).get(id=submission.id)

    data = SubmissionSerializer(submission).data

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'submission_result',  # maps to consumer method
            'data': data,
        }
    )
