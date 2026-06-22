from django.contrib import admin
from .models import Session, Submission, TestResult, UserExerciseProgress


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'exercise', 'status', 'submitted_at')
    list_filter = ('status', 'language')
    search_fields = ('user__username', 'exercise__name')
    readonly_fields = ('code', 'compile_output', 'task_id', 'submitted_at', 'completed_at')


@admin.register(UserExerciseProgress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'exercise', 'attempts', 'passed', 'passed_at')
    list_filter = ('passed', 'exercise__language')
    search_fields = ('user__username', 'exercise__name')


admin.site.register(Session)
admin.site.register(TestResult)
