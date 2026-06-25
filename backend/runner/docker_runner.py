"""
Docker-based code execution engine.
Compile once, run per test case — fast after first compilation.
"""
import subprocess
import tempfile
import os
import time
from typing import List, Dict
from dataclasses import dataclass, field

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
    timeout_seconds: int = 30,
    memory_limit: str = '512m',
) -> RunResult:
    file_extensions = {'go': 'go', 'python': 'py', 'javascript': 'js'}
    ext = file_extensions.get(language_slug, 'txt')
    code_file = f'solution.{ext}'

    with tempfile.TemporaryDirectory(dir='/app') as tmpdir:
        # Write code file
        with open(os.path.join(tmpdir, code_file), 'w') as f:
            f.write(code)

        host_tmpdir = tmpdir.replace('/app', HOST_APP_DIR, 1)

        # ── Step 1: Compile once ─────────────────────────────────────────────
        if language_slug == 'go':
            compile_result = _compile(
                host_tmpdir=host_tmpdir,
                tmpdir=tmpdir,
                docker_image=docker_image,
                code_file=code_file,
                memory_limit=memory_limit,
                timeout_seconds=timeout_seconds,
            )
            if compile_result is not None:
                return compile_result  # compile error — return early

        # ── Step 2: Run once per test case ───────────────────────────────────
        test_results = []
        for tc in test_cases:
            result = _run_test_case(
                host_tmpdir=host_tmpdir,
                docker_image=docker_image,
                code_file=code_file,
                tc=tc,
                language_slug=language_slug,
                memory_limit=memory_limit,
                timeout_seconds=timeout_seconds,
            )
            test_results.append(result)

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


def _compile(host_tmpdir, tmpdir, docker_image, code_file, memory_limit, timeout_seconds):
    """
    Run compile.sh inside a container. Outputs binary to tmpdir/bin on the host.
    Returns a RunResult on error, None on success.
    """
    try:
        proc = subprocess.run(
            [
                'docker', 'run', '--rm',
                '--memory', memory_limit,
                '--memory-swap', memory_limit,
                '--network', 'none',
                '--read-only',
                '--tmpfs', '/tmp:size=100m,exec',
                '--tmpfs', '/root/.cache:size=100m',
                '--cpus', '1.0',
                '-v', f'{host_tmpdir}:/code',   # NOT read-only — binary written here
                '--entrypoint', '/bin/sh',
                docker_image,
                '/compile.sh', code_file,
            ],
            capture_output=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        return RunResult(status='compile_error', compile_output='❌ Compilation timed out.')
    except Exception as e:
        return RunResult(status='compile_error', compile_output=f'❌ Compile runner error: {str(e)}')

    if proc.returncode != 0:
        stderr = proc.stderr.decode(errors='replace').strip()
        stdout = proc.stdout.decode(errors='replace').strip()
        return RunResult(
            status='compile_error',
            compile_output=f'❌ Compile error:\n{stderr or stdout}',
        )

    return None  # success


def _run_test_case(host_tmpdir, docker_image, code_file, tc, language_slug, memory_limit, timeout_seconds):
    """Run pre-compiled binary against a single test case."""
    start = time.time()
    stdin_data = tc.get('stdin', '')

    try:
        proc = subprocess.run(
            [
                'docker', 'run', '--rm',
                '--memory', '64m',             # less memory needed just to run
                '--memory-swap', '64m',
                '--network', 'none',
                '--read-only',
                '--tmpfs', '/tmp:size=50m,exec',
                '--tmpfs', '/root/.cache:size=50m',
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
        return TestCaseResult(
            test_case_id=tc['id'], order=tc['order'],
            passed=False, actual_output='',
            error_output='Time limit exceeded',
            execution_time_ms=timeout_seconds * 1000,
            is_hidden=tc['is_hidden'],
        )
    except Exception as e:
        return TestCaseResult(
            test_case_id=tc['id'], order=tc['order'],
            passed=False, actual_output='',
            error_output=f'Runner error: {str(e)}',
            execution_time_ms=0,
            is_hidden=tc['is_hidden'],
        )

    elapsed_ms = int((time.time() - start) * 1000)
    stdout = proc.stdout.decode(errors='replace').strip()
    stderr = proc.stderr.decode(errors='replace').strip()
    expected = tc['expected_output'].strip()
    passed = stdout == expected and proc.returncode == 0

    return TestCaseResult(
        test_case_id=tc['id'], order=tc['order'],
        passed=passed, actual_output=stdout,
        error_output=stderr if not passed else '',
        execution_time_ms=elapsed_ms,
        is_hidden=tc['is_hidden'],
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