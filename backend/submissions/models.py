from django.db import models
from django.conf import settings
from django.utils import timezone


class Session(models.Model):
    """A practice session — one student, one checkpoint, multiple attempts."""
    STATUS_ACTIVE = 'active'
    STATUS_COMPLETED = 'completed'
    STATUS_ABANDONED = 'abandoned'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_ABANDONED, 'Abandoned'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sessions'
    )
    checkpoint = models.ForeignKey(
        'exercises.Checkpoint', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='sessions'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    exercises_completed = models.ManyToManyField(
        'exercises.Exercise', blank=True, related_name='completed_in_sessions'
    )

    # Session persistence fields
    current_exercise = models.ForeignKey(
        'exercises.Exercise', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='current_sessions'
    )
    current_level_index = models.IntegerField(default=0)
    timer_seconds = models.IntegerField(default=0)
    timer_started_at = models.DateTimeField(null=True, blank=True)
    level_results = models.JSONField(default=list)
    expires_at = models.DateTimeField(null=True, blank=True)

    @property
    def duration_seconds(self):
        if self.ended_at:
            return (self.ended_at - self.started_at).seconds
        return None

    @property
    def time_remaining(self):
        """Calculate remaining timer seconds."""
        if not self.timer_seconds or not self.timer_started_at:
            return None
        elapsed = (timezone.now() - self.timer_started_at).total_seconds()
        remaining = self.timer_seconds - int(elapsed)
        return max(0, remaining)

    def __str__(self):
        return f"Session #{self.id} — {self.user.username}"

    class Meta:
        db_table = 'sessions'
        ordering = ['-started_at']


class Submission(models.Model):
    """A single code submission by a student for an exercise."""
    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_ACCEPTED = 'accepted'
    STATUS_WRONG_ANSWER = 'wrong_answer'
    STATUS_COMPILE_ERROR = 'compile_error'
    STATUS_RUNTIME_ERROR = 'runtime_error'
    STATUS_TIME_LIMIT = 'time_limit'
    STATUS_ILLEGAL_IMPORT = 'illegal_import'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_WRONG_ANSWER, 'Wrong Answer'),
        (STATUS_COMPILE_ERROR, 'Compile Error'),
        (STATUS_RUNTIME_ERROR, 'Runtime Error'),
        (STATUS_TIME_LIMIT, 'Time Limit Exceeded'),
        (STATUS_ILLEGAL_IMPORT, 'Illegal Import'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submissions'
    )
    exercise = models.ForeignKey(
        'exercises.Exercise', on_delete=models.CASCADE, related_name='submissions'
    )
    session = models.ForeignKey(
        Session, on_delete=models.SET_NULL, null=True, blank=True, related_name='submissions'
    )
    code = models.TextField()
    language = models.ForeignKey(
        'exercises.Language', on_delete=models.PROTECT
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    # Terminal output shown to student
    compile_output = models.TextField(blank=True)
    # Celery task ID for polling
    task_id = models.CharField(max_length=255, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    @property
    def passed(self):
        return self.status == self.STATUS_ACCEPTED

    def __str__(self):
        return f"Submission #{self.id} — {self.user.username} / {self.exercise.name} [{self.status}]"

    class Meta:
        db_table = 'submissions'
        ordering = ['-submitted_at']


class TestResult(models.Model):
    """Result of running one test case against a submission."""
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name='test_results'
    )
    test_case = models.ForeignKey(
        'exercises.TestCase', on_delete=models.CASCADE
    )
    passed = models.BooleanField()
    actual_output = models.TextField(blank=True)
    error_output = models.TextField(blank=True)
    execution_time_ms = models.IntegerField(null=True, blank=True)

    def __str__(self):
        result = 'PASS' if self.passed else 'FAIL'
        return f"{result} — TestCase #{self.test_case.order} / Submission #{self.submission.id}"

    class Meta:
        db_table = 'test_results'
        ordering = ['test_case__order']


class UserExerciseProgress(models.Model):
    """Tracks overall progress per user per exercise across all submissions."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='progress'
    )
    exercise = models.ForeignKey(
        'exercises.Exercise', on_delete=models.CASCADE, related_name='user_progress'
    )
    attempts = models.IntegerField(default=0)
    passed = models.BooleanField(default=False)
    best_submission = models.ForeignKey(
        Submission, on_delete=models.SET_NULL, null=True, blank=True
    )
    first_attempted = models.DateTimeField(auto_now_add=True)
    last_attempted = models.DateTimeField(auto_now=True)
    passed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        status = '✓' if self.passed else '✗'
        return f"{status} {self.user.username} — {self.exercise.name}"

    class Meta:
        db_table = 'user_exercise_progress'
        unique_together = ('user', 'exercise')