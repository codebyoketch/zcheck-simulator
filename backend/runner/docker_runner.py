"""
Docker-based code execution engine.
One container per test case — uses the static run.sh baked into the image.
Compiles and runs in a single container call per test case.
"""
import subprocess
import tempfile
import os
import time
from typing import List, Dict
from dataclasses import dataclass, field

# Translate /app inside Celery container → real host path for docker -v mounts
HOST_APP_DIR = os.environ.get('HOST_APP_DIR', '/app')


@dataclass
class TestCaseResult:
    test_case_id: int
    order: int
    passed: bool
    actual_output: str
    error_output: str
    execution_time_ms: int
    is_hidden: bool


@dataclass
class RunResult:
    status: str
    compile_output: str
    test_results: List[TestCaseResult] = field(default_factory=list)


def run_code(
    code: str,
    language_slug: str,
    docker_image: str,
    test_cases: List[Dict],
    timeout_seconds: int = 10,
    memory_limit: str = '64m',
) -> RunResult:
    file_extensions = {'go': 'go', 'python': 'py', 'javascript': 'js'}
    ext = file_extensions.get(language_slug, 'txt')
    code_file = f'solution.{ext}'

    with tempfile.TemporaryDirectory(dir='/app') as tmpdir:
        # Write code file once — shared across all test case runs
        with open(os.path.join(tmpdir, code_file), 'w') as f:
            f.write(code)

        # Translate container path → host path for docker volume mount
        host_tmpdir = tmpdir.replace('/app', HOST_APP_DIR, 1)

        test_results = []

        for i, tc in enumerate(test_cases):
            start = time.time()
            stdin_data = tc.get('stdin', '')

            try:
                proc = subprocess.run(
                    [
                        'docker', 'run', '--rm',
                        '--memory', memory_limit,
                        '--memory-swap', memory_limit,
                        '--network', 'none',
                        '--read-only',
                        '--tmpfs', '/tmp:size=50m,exec',    # exec needed to run compiled binary
                        '--tmpfs', '/tmp/sol:size=50m',
                        '--tmpfs', '/root/.cache:size=50m', # Go build cache
                        '--cpus', '0.5',
                        '-v', f'{host_tmpdir}:/code:ro',
                        docker_image,
                        code_file,
                    ],
                    input=stdin_data.encode(),
                    capture_output=True,
                    timeout=timeout_seconds + 5,
                )
            except subprocess.TimeoutExpired:
                test_results.append(TestCaseResult(
                    test_case_id=tc['id'],
                    order=tc['order'],
                    passed=False,
                    actual_output='',
                    error_output='Time limit exceeded',
                    execution_time_ms=timeout_seconds * 1000,
                    is_hidden=tc['is_hidden'],
                ))
                continue
            except Exception as e:
                test_results.append(TestCaseResult(
                    test_case_id=tc['id'],
                    order=tc['order'],
                    passed=False,
                    actual_output='',
                    error_output=f'Runner error: {str(e)}',
                    execution_time_ms=0,
                    is_hidden=tc['is_hidden'],
                ))
                continue

            elapsed_ms = int((time.time() - start) * 1000)
            stdout = proc.stdout.decode(errors='replace').strip()
            stderr = proc.stderr.decode(errors='replace').strip()

            # Compile error — non-zero exit and no stdout
            if proc.returncode != 0 and not stdout:
                return RunResult(
                    status='compile_error',
                    compile_output=f'❌ Compile error:\n{stderr}',
                )

            expected = tc['expected_output'].strip()
            passed = stdout == expected and proc.returncode == 0

            test_results.append(TestCaseResult(
                test_case_id=tc['id'],
                order=tc['order'],
                passed=passed,
                actual_output=stdout,
                error_output=stderr if not passed else '',
                execution_time_ms=elapsed_ms,
                is_hidden=tc['is_hidden'],
            ))

        all_passed = all(r.passed for r in test_results)
        has_tle    = any('time limit' in r.error_output.lower() for r in test_results)

        if all_passed:
            status = 'accepted'
        elif has_tle:
            status = 'time_limit'
        else:
            status = 'wrong_answer'

        return RunResult(
            status=status,
            compile_output=_build_terminal_output(test_results),
            test_results=test_results,
        )


def _build_terminal_output(results: List[TestCaseResult]) -> str:
    lines = []
    passed_count = sum(1 for r in results if r.passed)
    total = len(results)
    lines.append(f'Results: {passed_count}/{total} test cases passed\n')

    for r in results:
        status = '✅' if r.passed else '❌'
        if r.is_hidden:
            lines.append(f'{status} Test {r.order} (hidden): {"PASSED" if r.passed else "FAILED"}')
        else:
            if r.passed:
                lines.append(f'{status} Test {r.order}: PASSED')
            else:
                lines.append(f'{status} Test {r.order}: FAILED')
                if r.error_output:
                    lines.append(f'   Error:    {r.error_output}')
                else:
                    lines.append(f'   Expected: {repr(r.actual_output)}')
                    lines.append(f'   Got:      (wrong output)')

    return '\n'.join(lines)