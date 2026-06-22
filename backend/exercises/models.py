from django.db import models


class Language(models.Model):
    """A programming language supported by the platform."""
    name = models.CharField(max_length=50)           # e.g. "Go", "Python", "JavaScript"
    slug = models.SlugField(unique=True)             # e.g. "go", "python", "javascript"
    file_extension = models.CharField(max_length=10) # e.g. ".go", ".py", ".js"
    docker_image = models.CharField(max_length=200)  # e.g. "zcheck-go-runner:latest"
    timeout_seconds = models.IntegerField(default=10)
    memory_limit = models.CharField(max_length=20, default='64m')
    # Default forbidden imports for this language (comma-separated)
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
    """A checkpoint event (e.g. Checkpoint 01, Final Checkpoint)."""
    name = models.CharField(max_length=100)          # e.g. "Checkpoint 01"
    slug = models.SlugField(unique=True)             # e.g. "checkpoint-01"
    description = models.TextField(blank=True)
    language = models.ForeignKey(
        Language, on_delete=models.PROTECT, related_name='checkpoints'
    )
    order = models.IntegerField(default=0)           # for display ordering
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'checkpoints'
        ordering = ['order']


class Exercise(models.Model):
    """A single coding exercise (e.g. countalpha, onlyz)."""
    name = models.CharField(max_length=100)          # e.g. "countalpha"
    slug = models.SlugField(unique=True)             # e.g. "countalpha"
    description = models.TextField()                 # Markdown — from 01-edu README
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
    # Import control
    forbidden_imports = models.TextField(
        blank=True,
        help_text='Comma-separated imports NOT allowed. e.g. "fmt,os". Overrides language defaults.'
    )
    allowed_imports = models.TextField(
        blank=True,
        help_text='Comma-separated imports explicitly allowed. e.g. "z01". Leave blank for no restrictions.'
    )
    use_language_forbidden_defaults = models.BooleanField(
        default=True,
        help_text='If True, also applies the language-level forbidden imports.'
    )
    # Starter code shown in editor
    starter_code = models.TextField(
        blank=True,
        help_text='Boilerplate code shown to student when they open the exercise.'
    )
    xp_reward = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_forbidden_imports(self):
        """Return full list of forbidden imports for this exercise."""
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
    """A single test case for an exercise."""
    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, related_name='test_cases'
    )
    # stdin fed to the program (can be empty for exercises with no input)
    stdin = models.TextField(blank=True)
    # expected stdout
    expected_output = models.TextField()
    # Public: shown to student on failure (input + expected + actual)
    # Hidden: only shown as pass/fail
    is_hidden = models.BooleanField(
        default=False,
        help_text='Hidden test cases only show pass/fail — no input or expected output revealed.'
    )
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        visibility = 'hidden' if self.is_hidden else 'public'
        return f"TestCase #{self.order} ({visibility}) — {self.exercise.name}"

    class Meta:
        db_table = 'test_cases'
        ordering = ['exercise', 'order']
