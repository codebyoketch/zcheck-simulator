from rest_framework import serializers
from .models import Session, Submission, TestResult, UserExerciseProgress
from exercises.serializers import ExerciseListSerializer


class SubmitCodeSerializer(serializers.Serializer):
    """Input serializer for code submission."""
    exercise_slug = serializers.SlugField()
    code = serializers.CharField()
    session_id = serializers.IntegerField(required=False, allow_null=True)


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
            'test_results',
        )
        read_only_fields = fields


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
