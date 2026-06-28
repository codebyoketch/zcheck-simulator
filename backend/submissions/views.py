from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from .models import Session, Submission, UserExerciseProgress
from .serializers import (
    SubmitCodeSerializer, SubmissionSerializer,
    SessionSerializer, UserProgressSerializer,
)
from exercises.models import Exercise


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_code(request):
    """Submit code for an exercise. Returns submission ID for polling."""
    from runner.tasks import run_submission

    serializer = SubmitCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        exercise = Exercise.objects.select_related('language').get(
            slug=serializer.validated_data['exercise_slug'],
            is_active=True,
        )
    except Exercise.DoesNotExist:
        return Response({'detail': 'Exercise not found.'}, status=404)

    session_id = serializer.validated_data.get('session_id')
    session = None
    if session_id:
        try:
            session = Session.objects.get(id=session_id, user=request.user, status='active')
        except Session.DoesNotExist:
            pass

    submission = Submission.objects.create(
        user=request.user,
        exercise=exercise,
        session=session,
        code=serializer.validated_data['code'],
        language=exercise.language,
        status=Submission.STATUS_PENDING,
    )

    # Queue async execution
    task = run_submission.delay(submission.id)
    submission.task_id = task.id
    submission.save(update_fields=['task_id'])

    return Response(
        SubmissionSerializer(submission).data,
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def submission_status(request, pk):
    """Poll for submission result."""
    try:
        submission = Submission.objects.prefetch_related(
            'test_results__test_case'
        ).get(id=pk, user=request.user)
    except Submission.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    return Response(SubmissionSerializer(submission).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_progress(request):
    """All exercises and their pass/fail status for the current user."""
    progress = UserExerciseProgress.objects.filter(
        user=request.user
    ).select_related('exercise', 'exercise__language').order_by(
        'exercise__difficulty_pct', 'exercise__name'
    )
    serializer = UserProgressSerializer(progress, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_history(request):
    """Recent submission history for the current user."""
    submissions = Submission.objects.filter(
        user=request.user
    ).select_related('exercise').order_by('-submitted_at')[:50]
    serializer = SubmissionSerializer(submissions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_session(request):
    """Start a new practice session."""
    checkpoint_slug = request.data.get('checkpoint_slug')
    checkpoint = None

    if checkpoint_slug:
        from exercises.models import Checkpoint
        try:
            checkpoint = Checkpoint.objects.get(slug=checkpoint_slug)
        except Checkpoint.DoesNotExist:
            return Response({'detail': 'Checkpoint not found.'}, status=404)

    # Mark previous active sessions as abandoned
    Session.objects.filter(user=request.user, status='active').update(
        status='abandoned', ended_at=timezone.now()
    )

    session = Session.objects.create(user=request.user, checkpoint=checkpoint)
    return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def end_session(request, pk):
    """End a session."""
    try:
        session = Session.objects.get(id=pk, user=request.user)
    except Session.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    session.status = request.data.get('status', 'completed')
    session.ended_at = timezone.now()
    session.save(update_fields=['status', 'ended_at'])
    return Response(SessionSerializer(session).data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def active_session(request):
    """Get the user's active session for resuming."""
    try:
        session = Session.objects.select_related(
            'current_exercise', 'checkpoint'
        ).get(user=request.user, status='active')
    except Session.DoesNotExist:
        return Response(None)

    return Response({
        'id': session.id,
        'checkpoint_slug': session.checkpoint.slug if session.checkpoint else None,
        'current_level_index': session.current_level_index,
        'current_exercise_slug': session.current_exercise.slug if session.current_exercise else None,
        'timer_seconds': session.timer_seconds,
        'time_remaining': session.time_remaining,
        'level_results': session.level_results,
        'started_at': session.started_at,
    })


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_session(request, pk):
    """Save current session progress."""
    try:
        session = Session.objects.get(id=pk, user=request.user, status='active')
    except Session.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    exercise_slug = request.data.get('current_exercise_slug')
    if exercise_slug:
        try:
            session.current_exercise = Exercise.objects.get(slug=exercise_slug)
        except Exercise.DoesNotExist:
            pass

    if 'current_level_index' in request.data:
        session.current_level_index = request.data['current_level_index']
    if 'timer_seconds' in request.data:
        session.timer_seconds = request.data['timer_seconds']
        if not session.timer_started_at:
            session.timer_started_at = timezone.now()
    if 'level_results' in request.data:
        session.level_results = request.data['level_results']

    session.save()
    return Response({'status': 'updated'})