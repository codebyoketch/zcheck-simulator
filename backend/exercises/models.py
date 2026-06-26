from django.db import models


class Language(models.Model):
    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    file_extension = models.CharField(max_length=10)
    docker_image = models.CharField(max_length=200)
    timeout_seconds = models.IntegerField(default=10)
    memory_limit = models.CharField(max_length=20, default='64m')
    default_forbidden_imports = models.TextField(
        blank=True,
        help_text='Comma-separated. e.g. "fmt,os,net/http"'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def get_forbidden_imports_list(self):
        if not self.default_forbidden_imports:
            return []
        return [i.strip() for i in self.default_forbidden_imports.split(',') if i.strip()]

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'languages'


class Checkpoint(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    language = models.ForeignKey(
        Language, on_delete=models.PROTECT, related_name='checkpoints'
    )
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'checkpoints'
        ordering = ['order']


class Exercise(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField()
    difficulty_pct = models.IntegerField(
        help_text='Difficulty percentage (5, 10, 20, 35, 50, 65, 75, 85, 95, 100)'
    )
    language = models.ForeignKey(
        Language, on_delete=models.PROTECT, related_name='exercises'
    )
    checkpoint = models.ForeignKey(
        Checkpoint, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='exercises'
    )
    # Two-file structure (Zone01 style)
    main_file = models.TextField(
        blank=True,
        help_text='main.go content — package main, imports piscine, calls functions. Read-only for students.'
    )
    student_filename = models.CharField(
        max_length=100, default='solution.go',
        help_text='Filename for student file e.g. "countalpha.go". Shown as second tab.'
    )
    # Import control
    forbidden_imports = models.TextField(
        blank=True,
        help_text='Comma-separated imports NOT allowed.'
    )
    allowed_imports = models.TextField(
        blank=True,
        help_text='Comma-separated imports explicitly allowed.'
    )
    use_language_forbidden_defaults = models.BooleanField(default=True)
    starter_code = models.TextField(
        blank=True,
        help_text='Boilerplate shown in the student editor tab.'
    )
    xp_reward = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_forbidden_imports(self):
        imports = set()
        if self.use_language_forbidden_defaults:
            imports.update(self.language.get_forbidden_imports_list())
        if self.forbidden_imports:
            imports.update([i.strip() for i in self.forbidden_imports.split(',') if i.strip()])
        return list(imports)

    def get_allowed_imports(self):
        if not self.allowed_imports:
            return []
        return [i.strip() for i in self.allowed_imports.split(',') if i.strip()]

    def __str__(self):
        return f"{self.name} ({self.difficulty_pct}%)"

    class Meta:
        db_table = 'exercises'
        ordering = ['difficulty_pct', 'name']


class TestCase(models.Model):
    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, related_name='test_cases'
    )
    stdin = models.TextField(blank=True)
    expected_output = models.TextField()
    is_hidden = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        visibility = 'hidden' if self.is_hidden else 'public'
        return f"TestCase #{self.order} ({visibility}) — {self.exercise.name}"

    class Meta:
        db_table = 'test_cases'
        ordering = ['exercise', 'order']