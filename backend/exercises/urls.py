from django.urls import path
from . import views

urlpatterns = [
    # Student
    path('exercises/', views.ExerciseListView.as_view(), name='exercise_list'),
    path('exercises/random/', views.random_exercise, name='random_exercise'),
    path('exercises/<slug:slug>/', views.ExerciseDetailView.as_view(), name='exercise_detail'),
    path('exercises/<slug:slug>/test/', views.test_run, name='test_run'),  # ← new
    path('checkpoints/', views.CheckpointListView.as_view(), name='checkpoint_list'),
    path('languages/', views.LanguageListView.as_view(), name='language_list'),
    path('levels/', views.available_levels, name='available_levels'),
    # Admin
    path('admin/exercises/', views.AdminExerciseListCreateView.as_view()),
    path('admin/exercises/<slug:slug>/', views.AdminExerciseDetailView.as_view()),
    path('admin/exercises/<slug:slug>/test-cases/', views.AdminTestCaseListCreateView.as_view()),
    path('admin/test-cases/<int:pk>/', views.AdminTestCaseDetailView.as_view()),
    path('admin/languages/', views.AdminLanguageListCreateView.as_view()),
    path('admin/languages/<int:pk>/', views.AdminLanguageDetailView.as_view()),
    path('admin/checkpoints/', views.AdminCheckpointListCreateView.as_view()),
    path('admin/checkpoints/<slug:slug>/', views.AdminCheckpointDetailView.as_view()),
]
