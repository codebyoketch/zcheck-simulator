from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Extended user model for ZCheck students and admins."""

    ROLE_STUDENT = 'student'
    ROLE_ADMIN = 'admin'
    ROLE_CHOICES = [
        (ROLE_STUDENT, 'Student'),
        (ROLE_ADMIN, 'Admin'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    avatar_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    total_xp = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    block_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_admin_user(self):
        return self.role == self.ROLE_ADMIN or self.is_staff

    def recalculate_level(self):
        """Level = 1 per 1000 XP, starting at 1."""
        self.level = max(1, self.total_xp // 1000 + 1)

    def __str__(self):
        return f"{self.username} ({self.role})"

    class Meta:
        db_table = 'users'
        