from django.contrib import admin
from .models import Language, Checkpoint, Exercise, TestCase


class TestCaseInline(admin.TabularInline):
    model = TestCase
    extra = 2
    fields = ('order', 'stdin', 'expected_output', 'is_hidden')


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'docker_image', 'timeout_seconds', 'is_active')
    list_editable = ('is_active',)


@admin.register(Checkpoint)
class CheckpointAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'language', 'order', 'is_active')
    list_editable = ('order', 'is_active')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'difficulty_pct', 'language', 'checkpoint', 'is_active')
    list_filter = ('language', 'checkpoint', 'difficulty_pct', 'is_active')
    search_fields = ('name', 'slug')
    list_editable = ('is_active',)
    prepopulated_fields = {'slug': ('name',)}
    inlines = [TestCaseInline]
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'slug', 'description', 'difficulty_pct', 'language', 'checkpoint')
        }),
        ('Import Control', {
            'fields': ('forbidden_imports', 'allowed_imports', 'use_language_forbidden_defaults'),
            'description': 'Control which imports students can use in this exercise.'
        }),
        ('Editor', {
            'fields': ('starter_code', 'xp_reward', 'is_active')
        }),
    )


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    list_display = ('exercise', 'order', 'is_hidden', 'stdin', 'expected_output')
    list_filter = ('is_hidden', 'exercise__language')
    search_fields = ('exercise__name',)
