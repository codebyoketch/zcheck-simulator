"""
Docker-based code execution engine.
Spins up a language-specific container, runs code against test cases,
returns structured results.
"""
import subprocess
import tempfile
import os
import time
import json
from typing import List, Dict, Any
from dataclasses import dataclass


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
    status: str          # 'accepted', 'wrong_answer', 'compile_error', 'runtime_error', 'time_limit'
    compile_output: str  # shown to student
    test_results: List[TestCaseResult]


def run_code(
    code: str,
    language_slug: str,
    docker_image: str,
    test_cases: List[Dict],  # [{'id', 'order', 'stdin', 'expected_output', 'is_hidden'}]
    timeout_seconds: int = 10,
    memory_limit: str = '64m',
) -> RunResult:
    """
    Run code against all test cases using a Docker container.
    Each test case gets its own container run for isolation.
    """
    file_extensions = {'go': 'go', 'python': 'py', 'javascript': 'js'}
    ext = file_extensions.get(language_slug, 'txt')

    with tempfile.TemporaryDirectory() as tmpdir:
        # Write code to temp file
        code_file = os.path.join(tmpdir, f'solution.{ext}')
        with open(code_file, 'w') as f:
            f.write(code)

        test_results = []
        all_passed = True

        for tc in test_cases:
            result = _run_single_test(
                code_file=code_file,
                docker_image=docker_image,
                language_slug=language_slug,
                ext=ext,
                stdin=tc.get('stdin', ''),
                expected_output=tc['expected_output'],
                test_case_id=tc['id'],
                order=tc['order'],
                is_hidden=tc['is_hidden'],
                timeout_seconds=timeout_seconds,
                memory_limit=memory_limit,
                tmpdir=tmpdir,
            )
            test_results.append(result)
            if not result.passed:
                all_passed = False

        # Determine overall status
        if all_passed:
            status = 'accepted'
        else:
            # Check if any had compile/runtime errors
            has_compile_error = any(
                'compile error' in r.error_output.lower() or
                'syntax error' in r.error_output.lower()
                for r in test_results if r.error_output
            )
            has_timeout = any('timeout' in r.error_output.lower() for r in test_results)

            if has_compile_error:
                status = 'compile_error'
            elif has_timeout:
                status = 'time_limit'
            else:
                status = 'wrong_answer'

        compile_output = _build_terminal_output(test_results)

        return RunResult(
            status=status,
            compile_output=compile_output,
            test_results=test_results,
        )


def _run_single_test(
    code_file, docker_image, language_slug, ext, stdin,
    expected_output, test_case_id, order, is_hidden,
    timeout_seconds, memory_limit, tmpdir
) -> TestCaseResult:

    start = time.time()

    docker_cmd = [
        'docker', 'run', '--rm',
        '--memory', memory_limit,
        '--memory-swap', memory_limit,
        '--network', 'none',         # no internet
        '--read-only',               # read-only filesystem
        '--tmpfs', '/tmp:size=10m',  # small writable tmp
        '--cpus', '0.5',
        '-v', f'{tmpdir}:/code:ro',  # mount code read-only
        '-w', '/code',
        docker_image,
        f'solution.{ext}',
    ]

    try:
        proc = subprocess.run(
            docker_cmd,
            input=stdin.encode(),
            capture_output=True,
            timeout=timeout_seconds,
        )
        elapsed_ms = int((time.time() - start) * 1000)
        actual_output = proc.stdout.decode(errors='replace').strip()
        error_output = proc.stderr.decode(errors='replace').strip()
        expected = expected_output.strip()
        passed = (actual_output == expected) and proc.returncode == 0

        return TestCaseResult(
            test_case_id=test_case_id,
            order=order,
            passed=passed,
            actual_output=actual_output,
            error_output=error_output,
            execution_time_ms=elapsed_ms,
            is_hidden=is_hidden,
        )

    except subprocess.TimeoutExpired:
        return TestCaseResult(
            test_case_id=test_case_id,
            order=order,
            passed=False,
            actual_output='',
            error_output=f'Time limit exceeded ({timeout_seconds}s)',
            execution_time_ms=timeout_seconds * 1000,
            is_hidden=is_hidden,
        )
    except Exception as e:
        return TestCaseResult(
            test_case_id=test_case_id,
            order=order,
            passed=False,
            actual_output='',
            error_output=f'Runner error: {str(e)}',
            execution_time_ms=0,
            is_hidden=is_hidden,
        )


def _build_terminal_output(results: List[TestCaseResult]) -> str:
    """Build the terminal output string shown to the student."""
    lines = []
    for r in results:
        status = '✅' if r.passed else '❌'
        if r.is_hidden:
            # Hidden: only pass/fail, NO input/output revealed
            lines.append(f'{status} Test {r.order} (hidden): {"PASSED" if r.passed else "FAILED"}')
        else:
            # Public: show full detail on failure
            if r.passed:
                lines.append(f'{status} Test {r.order}: PASSED ({r.execution_time_ms}ms)')
            else:
                lines.append(f'{status} Test {r.order}: FAILED')
                if r.error_output:
                    lines.append(f'   Error:    {r.error_output}')
                else:
                    lines.append(f'   Expected: {repr(r.actual_output)} (your output)')
    return '\n'.join(lines)
