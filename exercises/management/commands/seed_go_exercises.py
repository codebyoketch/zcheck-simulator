"""
Management command to seed the Go exercises from zone01 Elementary Programming.
Run: python manage.py seed_go_exercises
"""
from django.core.management.base import BaseCommand
from exercises.models import Language, Checkpoint, Exercise, TestCase

GO_EXERCISES = [
    {'name': 'onlyz', 'difficulty_pct': 5, 'forbidden_imports': 'fmt', 'allowed_imports': 'z01',
     'description': '## onlyz\n\nWrite a function `OnlyZ` that prints the letter `z` followed by a newline.',
     'starter_code': 'package main\n\nfunc OnlyZ() {\n\t// your code here\n}\n',
     'test_cases': [
         {'stdin': '', 'expected_output': 'z', 'is_hidden': False, 'order': 1},
         {'stdin': '', 'expected_output': 'z', 'is_hidden': True, 'order': 2},
     ]},
    {'name': 'onlya', 'difficulty_pct': 5, 'forbidden_imports': 'fmt', 'allowed_imports': 'z01',
     'description': '## onlya\n\nWrite a function `OnlyA` that prints the letter `a` followed by a newline.',
     'starter_code': 'package main\n\nfunc OnlyA() {\n\t// your code here\n}\n',
     'test_cases': [
         {'stdin': '', 'expected_output': 'a', 'is_hidden': False, 'order': 1},
     ]},
    {'name': 'onlyb', 'difficulty_pct': 5, 'forbidden_imports': 'fmt', 'allowed_imports': 'z01',
     'description': '## onlyb\n\nWrite a function `OnlyB` that prints the letter `b` followed by a newline.',
     'starter_code': 'package main\n\nfunc OnlyB() {\n\t// your code here\n}\n',
     'test_cases': [
         {'stdin': '', 'expected_output': 'b', 'is_hidden': False, 'order': 1},
     ]},
    {'name': 'onlyf', 'difficulty_pct': 5, 'forbidden_imports': 'fmt', 'allowed_imports': 'z01',
     'description': '## onlyf\n\nWrite a function `OnlyF` that prints the letter `f` followed by a newline.',
     'starter_code': 'package main\n\nfunc OnlyF() {\n\t// your code here\n}\n',
     'test_cases': [
         {'stdin': '', 'expected_output': 'f', 'is_hidden': False, 'order': 1},
     ]},
    {'name': 'only1', 'difficulty_pct': 5, 'forbidden_imports': 'fmt', 'allowed_imports': 'z01',
     'description': '## only1\n\nWrite a function `Only1` that prints the number `1` followed by a newline.',
     'starter_code': 'package main\n\nfunc Only1() {\n\t// your code here\n}\n',
     'test_cases': [
         {'stdin': '', 'expected_output': '1', 'is_hidden': False, 'order': 1},
     ]},
    {'name': 'countalpha', 'difficulty_pct': 10, 'forbidden_imports': '', 'allowed_imports': '',
     'description': '## countalpha\n\nWrite a function `CountAlpha` that takes a string and returns the number of alphabetic characters.\n\n```go\nfmt.Println(CountAlpha("Hello world")) // 10\nfmt.Println(CountAlpha("H e l l o"))  // 5\nfmt.Println(CountAlpha("H1e2l3l4o"))  // 5\n```',
     'starter_code': 'package main\n\nfunc CountAlpha(s string) int {\n\t// your code here\n\treturn 0\n}\n',
     'test_cases': [
         {'stdin': '', 'expected_output': '10', 'is_hidden': False, 'order': 1},
         {'stdin': '', 'expected_output': '5', 'is_hidden': False, 'order': 2},
         {'stdin': '', 'expected_output': '5', 'is_hidden': False, 'order': 3},
         {'stdin': '', 'expected_output': '0', 'is_hidden': True, 'order': 4},
         {'stdin': '', 'expected_output': '26', 'is_hidden': True, 'order': 5},
     ]},
    {'name': 'checknumber', 'difficulty_pct': 10, 'forbidden_imports': '', 'allowed_imports': '',
     'description': '## checknumber\n\nWrite a function `CheckNumber` that takes an `int` and returns `"even"` or `"odd"`.',
     'starter_code': 'package main\n\nfunc CheckNumber(n int) string {\n\treturn ""\n}\n',
     'test_cases': [
         {'stdin': '', 'expected_output': 'even', 'is_hidden': False, 'order': 1},
         {'stdin': '', 'expected_output': 'odd', 'is_hidden': False, 'order': 2},
         {'stdin': '', 'expected_output': 'even', 'is_hidden': True, 'order': 3},
     ]},
]

class Command(BaseCommand):
    help = 'Seed Go exercises from zone01 Elementary Programming checkpoint'

    def handle(self, *args, **options):
        go_lang, _ = Language.objects.get_or_create(
            slug='go',
            defaults={
                'name': 'Go', 'file_extension': '.go',
                'docker_image': 'zcheck-go-runner:latest',
                'timeout_seconds': 10, 'memory_limit': '64m',
            }
        )
        checkpoint, _ = Checkpoint.objects.get_or_create(
            slug='elementary-programming',
            defaults={
                'name': 'Elementary Programming',
                'description': 'Zone01 Go Piscine — Elementary Programming checkpoint.',
                'language': go_lang, 'order': 1,
            }
        )
        for data in GO_EXERCISES:
            exercise, created = Exercise.objects.get_or_create(
                slug=data['name'],
                defaults={
                    'name': data['name'], 'description': data['description'],
                    'difficulty_pct': data['difficulty_pct'], 'language': go_lang,
                    'checkpoint': checkpoint, 'forbidden_imports': data['forbidden_imports'],
                    'allowed_imports': data['allowed_imports'], 'starter_code': data['starter_code'],
                    'xp_reward': data['difficulty_pct'] * 10, 'use_language_forbidden_defaults': False,
                }
            )
            if created:
                for tc in data['test_cases']:
                    TestCase.objects.create(exercise=exercise, **tc)
                self.stdout.write(f'  + {exercise.name} ({exercise.difficulty_pct}%)')
            else:
                self.stdout.write(f'  ~ {exercise.name} already exists')
        self.stdout.write(self.style.SUCCESS('Done! Add remaining exercises via Django Admin.'))
