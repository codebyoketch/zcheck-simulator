from rest_framework import serializers
from .models import Language, Checkpoint, Exercise, TestCase


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ('id', 'name', 'slug', 'file_extension', 'is_active')


class LanguageAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = '__all__'


class CheckpointSerializer(serializers.ModelSerializer):
    language = LanguageSerializer(read_only=True)
    exercise_count = serializers.IntegerField(source='exercises.count', read_only=True)

    class Meta:
        model = Checkpoint
        fields = ('id', 'name', 'slug', 'description', 'language', 'order', 'exercise_count')


class CheckpointAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkpoint
        fields = '__all__'


class TestCasePublicSerializer(serializers.ModelSerializer):
    """For students — hidden test cases show no input/output."""
    stdin = serializers.SerializerMethodField()
    expected_output = serializers.SerializerMethodField()

    class Meta:
        model = TestCase
        fields = ('id', 'stdin', 'expected_output', 'is_hidden', 'order')

    def get_stdin(self, obj):
        return None if obj.is_hidden else obj.stdin

    def get_expected_output(self, obj):
        return None if obj.is_hidden else obj.expected_output


class TestCaseAdminSerializer(serializers.ModelSerializer):
    """For admins — full access."""
    class Meta:
        model = TestCase
        fields = '__all__'


class ExerciseSerializer(serializers.ModelSerializer):
    """For students — no hidden test case content leaked."""
    language = LanguageSerializer(read_only=True)
    checkpoint = CheckpointSerializer(read_only=True)
    test_cases = TestCasePublicSerializer(many=True, read_only=True)
    total_test_cases = serializers.IntegerField(source='test_cases.count', read_only=True)
    hidden_test_cases = serializers.SerializerMethodField()
    public_test_cases = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = (
            'id', 'name', 'slug', 'description', 'difficulty_pct',
            'language', 'checkpoint', 'starter_code', 'xp_reward',
            'test_cases', 'total_test_cases', 'hidden_test_cases', 'public_test_cases',
        )

    def get_hidden_test_cases(self, obj):
        return obj.test_cases.filter(is_hidden=True).count()

    def get_public_test_cases(self, obj):
        return obj.test_cases.filter(is_hidden=False).count()


class ExerciseAdminSerializer(serializers.ModelSerializer):
    test_cases = TestCaseAdminSerializer(many=True, read_only=True)

    class Meta:
        model = Exercise
        fields = '__all__'


class ExerciseListSerializer(serializers.ModelSerializer):
    """Lightweight — for listing, no test cases."""
    language = LanguageSerializer(read_only=True)

    class Meta:
        model = Exercise
        fields = ('id', 'name', 'slug', 'difficulty_pct', 'language', 'xp_reward', 'is_active')
