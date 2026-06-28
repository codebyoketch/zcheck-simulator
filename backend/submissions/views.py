from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import Session, Submission, UserExerciseProgress
from .serializers import (
    SubmitCodeSerializer, SubmissionSerializer,
    SessionSerializer, UserProgressSerializer,
    ExerciseHistorySerializer,
    AdminSubmissionSerializer, AdminSessionSerializer,
)
from exercises.models import Exercise

User = get_user_model()


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
        exercise_started_at=serializer.validated_data.get('exercise_started_at'),
    )

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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def exercise_history(request, slug):
    """
    All submissions by the current user for a specific exercise.
    No limit — full history for sandbox page display.
    """
    submissions = Submission.objects.filter(
        user=request.user,
        exercise__slug=slug,
    ).order_by('-submitted_at')
    serializer = ExerciseHistorySerializer(submissions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_session(request):
    """Start a new practice session."""
    from datetime import timedelta

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

    timer_seconds = request.data.get('timer_seconds', 0)
    expires_at = (
        timezone.now() + timedelta(seconds=timer_seconds)
        if timer_seconds
        else timezone.now() + timedelta(hours=24)
    )

    session = Session.objects.create(
        user=request.user,
        checkpoint=checkpoint,
        timer_seconds=timer_seconds,
        timer_started_at=timezone.now() if timer_seconds else None,
        expires_at=expires_at,
    )
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

    # Check if session has expired
    if session.expires_at and timezone.now() > session.expires_at:
        session.status = 'abandoned'
        session.ended_at = timezone.now()
        session.save(update_fields=['status', 'ended_at'])
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


# ── Admin views ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_users_list(request):
    """List all users with basic info for admin submission browser."""
    users = User.objects.all().order_by('username')
    data = [
        {'id': u.id, 'username': u.username, 'email': u.email}
        for u in users
    ]
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_user_submissions(request, user_id):
    """
    All submissions for a specific user.
    Supports filtering by: checkpoint_slug, exercise_slug, date_from, date_to, status.
    Supports sorting by: submitted_at (default), exercise_name, difficulty_pct, duration.
    All records kept — no limit.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    qs = Submission.objects.filter(user=user).select_related(
        'exercise', 'exercise__checkpoint', 'exercise__language', 'session'
    )

    # Filters
    checkpoint_slug = request.query_params.get('checkpoint')
    exercise_slug   = request.query_params.get('exercise')
    date_from       = request.query_params.get('date_from')
    date_to         = request.query_params.get('date_to')
    status_filter   = request.query_params.get('status')

    if checkpoint_slug:
        qs = qs.filter(exercise__checkpoint__slug=checkpoint_slug)
    if exercise_slug:
        qs = qs.filter(exercise__slug=exercise_slug)
    if date_from:
        qs = qs.filter(submitted_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(submitted_at__date__lte=date_to)
    if status_filter:
        qs = qs.filter(status=status_filter)

    # Sorting
    sort = request.query_params.get('sort', '-submitted_at')
    allowed_sorts = {
        'submitted_at': 'submitted_at',
        '-submitted_at': '-submitted_at',
        'exercise': 'exercise__name',
        '-exercise': '-exercise__name',
        'difficulty': 'exercise__difficulty_pct',
        '-difficulty': '-exercise__difficulty_pct',
    }
    qs = qs.order_by(allowed_sorts.get(sort, '-submitted_at'))

    serializer = AdminSubmissionSerializer(qs, many=True)
    return Response({
        'user': {'id': user.id, 'username': user.username, 'email': user.email},
        'submissions': serializer.data,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_user_sessions(request, user_id):
    """
    All practice sessions for a specific user.
    Supports filtering by: checkpoint_slug, date_from, date_to, status.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    qs = Session.objects.filter(user=user).select_related('checkpoint')

    checkpoint_slug = request.query_params.get('checkpoint')
    date_from       = request.query_params.get('date_from')
    date_to         = request.query_params.get('date_to')
    status_filter   = request.query_params.get('status')

    if checkpoint_slug:
        qs = qs.filter(checkpoint__slug=checkpoint_slug)
    if date_from:
        qs = qs.filter(started_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(started_at__date__lte=date_to)
    if status_filter:
        qs = qs.filter(status=status_filter)

    qs = qs.order_by('-started_at')
    serializer = AdminSessionSerializer(qs, many=True)
    return Response({
        'user': {'id': user.id, 'username': user.username, 'email': user.email},
        'sessions': serializer.data,
    })