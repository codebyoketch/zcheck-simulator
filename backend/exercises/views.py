import random
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Language, Checkpoint, Exercise, TestCase
from .serializers import (
    LanguageSerializer, LanguageAdminSerializer,
    CheckpointSerializer, CheckpointAdminSerializer,
    ExerciseSerializer, ExerciseAdminSerializer, ExerciseListSerializer,
    TestCaseAdminSerializer,
)


# ── Student-facing views ──────────────────────────────────────────────────────

class ExerciseListView(generics.ListAPIView):
    serializer_class = ExerciseListSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['difficulty_pct', 'language__slug', 'checkpoint__slug']
    search_fields = ['name', 'description']

    def get_queryset(self):
        return Exercise.objects.filter(is_active=True).select_related('language', 'checkpoint')


class ExerciseDetailView(generics.RetrieveAPIView):
    serializer_class = ExerciseSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'slug'

    def get_queryset(self):
        return Exercise.objects.filter(is_active=True).prefetch_related('test_cases')


class CheckpointListView(generics.ListAPIView):
    serializer_class = CheckpointSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Checkpoint.objects.filter(is_active=True).select_related('language')


class LanguageListView(generics.ListAPIView):
    serializer_class = LanguageSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Language.objects.filter(is_active=True)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def random_exercise(request):
    """Return a random exercise, optionally filtered by checkpoint or difficulty."""
    qs = Exercise.objects.filter(is_active=True)

    checkpoint_slug = request.query_params.get('checkpoint')
    difficulty = request.query_params.get('difficulty_pct')
    language_slug = request.query_params.get('language')
    exclude_ids = request.query_params.getlist('exclude')  # already-seen exercise IDs

    if checkpoint_slug:
        qs = qs.filter(checkpoint__slug=checkpoint_slug)
    if difficulty:
        qs = qs.filter(difficulty_pct=difficulty)
    if language_slug:
        qs = qs.filter(language__slug=language_slug)
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)

    if not qs.exists():
        return Response({'detail': 'No exercises found matching criteria.'}, status=404)

    exercise = random.choice(list(qs))
    serializer = ExerciseSerializer(exercise)
    return Response(serializer.data)


# ── Admin views ───────────────────────────────────────────────────────────────

class AdminExerciseListCreateView(generics.ListCreateAPIView):
    queryset = Exercise.objects.all().select_related('language', 'checkpoint')
    serializer_class = ExerciseAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    search_fields = ['name', 'slug']
    filterset_fields = ['language', 'checkpoint', 'difficulty_pct', 'is_active']


class AdminExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'slug'


class AdminTestCaseListCreateView(generics.ListCreateAPIView):
    serializer_class = TestCaseAdminSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return TestCase.objects.filter(exercise__slug=self.kwargs['slug'])

    def perform_create(self, serializer):
        exercise = Exercise.objects.get(slug=self.kwargs['slug'])
        serializer.save(exercise=exercise)


class AdminTestCaseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseAdminSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminLanguageListCreateView(generics.ListCreateAPIView):
    queryset = Language.objects.all()
    serializer_class = LanguageAdminSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminLanguageDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Language.objects.all()
    serializer_class = LanguageAdminSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminCheckpointListCreateView(generics.ListCreateAPIView):
    queryset = Checkpoint.objects.all()
    serializer_class = CheckpointAdminSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminCheckpointDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Checkpoint.objects.all()
    serializer_class = CheckpointAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'slug'


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def available_levels(request):
    """
    Return the difficulty levels that actually have exercises in the bank.
    Optionally filtered by checkpoint.
    Used by the frontend to build the session level progression.
    """
    qs = Exercise.objects.filter(is_active=True)
    checkpoint_slug = request.query_params.get('checkpoint')
    language_slug   = request.query_params.get('language')
    if checkpoint_slug:
        qs = qs.filter(checkpoint__slug=checkpoint_slug)
    if language_slug:
        qs = qs.filter(language__slug=language_slug)

    levels = list(
        qs.values_list('difficulty_pct', flat=True)
        .distinct()
        .order_by('difficulty_pct')
    )
    return Response({'levels': levels})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_run(request, slug):
    """
    Run student code against the visible main_file (not submit_main_file).
    No test cases — just compile and run, return raw output.
    Used by the Test button in the frontend.
    """
    from runner.docker_runner import run_code

    try:
        exercise = Exercise.objects.select_related('language').get(slug=slug, is_active=True)
    except Exercise.DoesNotExist:
        return Response({'detail': 'Exercise not found.'}, status=404)

    code = request.data.get('code', '')
    main_code = request.data.get('main_code', None)  # editable main.go from frontend

    if not code:
        return Response({'detail': 'No code provided.'}, status=400)

    # Use a single fake test case with no stdin and no expected output check
    fake_test_case = {
        'id': 0,
        'order': 1,
        'stdin': '',
        'expected_output': '',
        'is_hidden': False,
    }

    try:
        result = run_code(
            code=code,
            language_slug=exercise.language.slug,
            docker_image=exercise.language.docker_image,
            test_cases=[fake_test_case],
            timeout_seconds=exercise.language.timeout_seconds,
            memory_limit=exercise.language.memory_limit,
            main_file=main_code or exercise.main_file or None,  # use frontend version first
            student_filename=exercise.student_filename or None,
            test_mode=True,
        )
    except Exception as e:
        return Response({'output': f'Runner error: {str(e)}', 'status': 'error'})

    return Response({
        'output': result.compile_output,
        'status': result.status,
    })