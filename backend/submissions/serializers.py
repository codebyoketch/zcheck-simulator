from rest_framework import serializers
from .models import Session, Submission, TestResult, UserExerciseProgress
from exercises.serializers import ExerciseListSerializer


class SubmitCodeSerializer(serializers.Serializer):
    """Input serializer for code submission."""
    exercise_slug = serializers.SlugField()
    code = serializers.CharField()
    session_id = serializers.IntegerField(required=False, allow_null=True)
    exercise_started_at = serializers.DateTimeField(required=False, allow_null=True)


class TestResultSerializer(serializers.ModelSerializer):
    """Result of one test case — hides hidden test case details."""
    stdin = serializers.SerializerMethodField()
    expected_output = serializers.SerializerMethodField()

    class Meta:
        model = TestResult
        fields = ('test_case_id', 'passed', 'actual_output', 'error_output',
                  'execution_time_ms', 'stdin', 'expected_output')

    def get_stdin(self, obj):
        return None if obj.test_case.is_hidden else obj.test_case.stdin

    def get_expected_output(self, obj):
        return None if obj.test_case.is_hidden else obj.test_case.expected_output


class SubmissionSerializer(serializers.ModelSerializer):
    test_results = TestResultSerializer(many=True, read_only=True)
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)
    exercise_slug = serializers.CharField(source='exercise.slug', read_only=True)

    class Meta:
        model = Submission
        fields = (
            'id', 'exercise_name', 'exercise_slug', 'status',
            'compile_output', 'task_id', 'submitted_at', 'completed_at',
            'exercise_started_at', 'test_results',
        )
        read_only_fields = fields


class ExerciseHistorySerializer(serializers.ModelSerializer):
    """Per-exercise submission history shown in the sandbox page."""
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = (
            'id', 'status', 'submitted_at', 'completed_at',
            'exercise_started_at', 'duration_seconds',
        )

    def get_duration_seconds(self, obj):
        if obj.exercise_started_at and obj.completed_at:
            return int((obj.completed_at - obj.exercise_started_at).total_seconds())
        return None


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ('id', 'checkpoint', 'status', 'started_at', 'ended_at')


class UserProgressSerializer(serializers.ModelSerializer):
    exercise = ExerciseListSerializer(read_only=True)

    class Meta:
        model = UserExerciseProgress
        fields = (
            'exercise', 'attempts', 'passed',
            'first_attempted', 'last_attempted', 'passed_at',
        )


# ── Admin serializers ─────────────────────────────────────────────────────────

class AdminSubmissionSerializer(serializers.ModelSerializer):
    """Full submission detail for admin views."""
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)
    exercise_slug = serializers.CharField(source='exercise.slug', read_only=True)
    checkpoint_name = serializers.SerializerMethodField()
    checkpoint_slug = serializers.SerializerMethodField()
    difficulty_pct = serializers.IntegerField(source='exercise.difficulty_pct', read_only=True)
    language = serializers.CharField(source='exercise.language.slug', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    session_id = serializers.IntegerField(source='session.id', read_only=True, allow_null=True)
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = (
            'id', 'username', 'exercise_name', 'exercise_slug',
            'checkpoint_name', 'checkpoint_slug', 'difficulty_pct',
            'language',
            'status', 'submitted_at', 'completed_at',
            'exercise_started_at', 'duration_seconds',
            'session_id', 'compile_output', 'code',
        )

    def get_checkpoint_name(self, obj):
        return obj.exercise.checkpoint.name if obj.exercise.checkpoint else None

    def get_checkpoint_slug(self, obj):
        return obj.exercise.checkpoint.slug if obj.exercise.checkpoint else None

    def get_duration_seconds(self, obj):
        if obj.exercise_started_at and obj.completed_at:
            return int((obj.completed_at - obj.exercise_started_at).total_seconds())
        return None


class AdminSessionSerializer(serializers.ModelSerializer):
    """Full session detail for admin views."""
    username = serializers.CharField(source='user.username', read_only=True)
    checkpoint_name = serializers.CharField(source='checkpoint.name', read_only=True, allow_null=True)
    checkpoint_slug = serializers.CharField(source='checkpoint.slug', read_only=True, allow_null=True)
    duration_seconds = serializers.SerializerMethodField()
    submission_count = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = (
            'id', 'username', 'checkpoint_name', 'checkpoint_slug',
            'status', 'started_at', 'ended_at', 'duration_seconds',
            'timer_seconds', 'level_results', 'submission_count',
        )

    def get_duration_seconds(self, obj):
        if obj.started_at and obj.ended_at:
            return int((obj.ended_at - obj.started_at).total_seconds())
        return None

    def get_submission_count(self, obj):
        return obj.submissions.count()