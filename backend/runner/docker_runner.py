"""
Docker-based code execution engine.
Compile once, run per test case — fast after first compilation.
Supports Zone01 two-file structure: main.go + student file.
"""
import subprocess
import tempfile
import os
import time
import shutil
from typing import List, Dict, Optional
from dataclasses import dataclass, field

HOST_APP_DIR = os.environ.get('HOST_APP_DIR', '/app')


@dataclass
class TestCaseResult:
    test_case_id: int
    order: int
    passed: bool
    actual_output: str
    expected_output: str
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
    main_file: Optional[str] = None,
    submit_main_file: Optional[str] = None,
    student_filename: Optional[str] = None,
    test_mode: bool = False,
) -> RunResult:
    file_extensions = {'go': 'go', 'python': 'py', 'javascript': 'js'}
    ext = file_extensions.get(language_slug, 'txt')
    student_filename = student_filename or f'solution.{ext}'

    if test_mode:
        active_main = main_file
    else:
        active_main = submit_main_file or main_file

    tmpdir = tempfile.mkdtemp(dir='/app')
    try:
        with open(os.path.join(tmpdir, student_filename), 'w') as f:
            f.write(code)

        if active_main:
            with open(os.path.join(tmpdir, 'main.go'), 'w') as f:
                f.write(active_main)

        host_tmpdir = tmpdir.replace('/app', HOST_APP_DIR, 1)

        if language_slug == 'go':
            compile_result = _compile(
                host_tmpdir=host_tmpdir,
                docker_image=docker_image,
                student_filename=student_filename,
                timeout_seconds=timeout_seconds,
            )
            if compile_result is not None:
                return compile_result

            # Fix permissions so Docker can read the tmpdir and bin
            os.chmod(tmpdir, 0o755)
            bin_path = os.path.join(tmpdir, 'bin')
            if os.path.exists(bin_path):
                os.chmod(bin_path, 0o755)

        print(f"[DEBUG] tmpdir exists before run: {os.path.exists(tmpdir)}", flush=True)
        print(f"[DEBUG] bin exists: {os.path.exists(os.path.join(tmpdir, 'bin'))}", flush=True)

        test_results = []
        for tc in test_cases:
            result = _run_test_case(
                host_tmpdir=host_tmpdir,
                docker_image=docker_image,
                student_filename=student_filename,
                tc=tc,
                timeout_seconds=timeout_seconds,
                test_mode=test_mode,
            )
            test_results.append(result)

        if test_mode:
            output = test_results[0].actual_output if test_results else ''
            error  = test_results[0].error_output  if test_results else ''
            return RunResult(
                status='test_run',
                compile_output=output or error or '(no output)',
                test_results=test_results,
            )

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
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _compile(host_tmpdir, docker_image, student_filename, timeout_seconds):
    try:
        proc = subprocess.run(
            [
                'docker', 'run', '--rm',
                '-i',
                '--memory', '1g',
                '--memory-swap', '1g',
                '--network', 'none',
                '--tmpfs', '/tmp:size=400m,exec',
                '--cpus', '1.0',
                '-v', f'{host_tmpdir}:/code',
                '--entrypoint', '/bin/sh',
                docker_image,
                '/compile.sh', student_filename,
            ],
            capture_output=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        return RunResult(status='compile_error', compile_output='❌ Compilation timed out.')
    except Exception as e:
        return RunResult(status='compile_error', compile_output=f'❌ Compile runner error: {str(e)}')

    compile_stderr = proc.stderr.decode(errors='replace').strip()
    compile_stdout = proc.stdout.decode(errors='replace').strip()

    if proc.returncode != 0:
        return RunResult(
            status='compile_error',
            compile_output=f'❌ Compile error:\n{compile_stderr or compile_stdout}',
        )
    return None


def _run_test_case(host_tmpdir, docker_image, student_filename, tc, timeout_seconds, test_mode=False):
    start = time.time()
    stdin_data = tc.get('stdin', '')

    try:
        proc = subprocess.run(
            [
                'docker', 'run', '--rm',
                '-i',
                '--memory', '64m',
                '--memory-swap', '64m',
                '--network', 'none',
                '--read-only',
                '--tmpfs', '/tmp:size=50m,exec',
                '--tmpfs', '/root/.cache:size=50m',
                '--cpus', '0.5',
                '-v', f'{host_tmpdir}:/code:ro',
                docker_image,
            ],
            input=stdin_data.encode(),
            capture_output=True,
            timeout=timeout_seconds + 5,
        )
    except subprocess.TimeoutExpired:
        return TestCaseResult(
            test_case_id=tc['id'], order=tc['order'],
            passed=False, actual_output='',
            expected_output=tc.get('expected_output', ''),
            error_output='Time limit exceeded',
            execution_time_ms=timeout_seconds * 1000,
            is_hidden=tc.get('is_hidden', False),
        )
    except Exception as e:
        return TestCaseResult(
            test_case_id=tc['id'], order=tc['order'],
            passed=False, actual_output='',
            expected_output=tc.get('expected_output', ''),
            error_output=f'Runner error: {str(e)}',
            execution_time_ms=0,
            is_hidden=tc.get('is_hidden', False),
        )

    elapsed_ms = int((time.time() - start) * 1000)
    stdout = proc.stdout.decode(errors='replace').strip()
    stderr = proc.stderr.decode(errors='replace').strip()

    print(f"[DEBUG] run returncode: {proc.returncode}", flush=True)
    print(f"[DEBUG] run stdout: {repr(stdout)}", flush=True)
    print(f"[DEBUG] run stderr: {repr(stderr)}", flush=True)
    print(f"[DEBUG] stdin_data: {repr(stdin_data)}", flush=True)

    if test_mode:
        return TestCaseResult(
            test_case_id=tc['id'], order=tc['order'],
            passed=True, actual_output=stdout,
            expected_output='',
            error_output=stderr,
            execution_time_ms=elapsed_ms,
            is_hidden=False,
        )

    expected = tc['expected_output'].strip()
    passed = stdout == expected and proc.returncode == 0

    return TestCaseResult(
        test_case_id=tc['id'], order=tc['order'],
        passed=passed, actual_output=stdout,
        expected_output=expected,
        error_output=stderr if not passed else '',
        execution_time_ms=elapsed_ms,
        is_hidden=tc.get('is_hidden', False),
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
                    lines.append(f'   Expected: {repr(r.expected_output)}')
                    lines.append(f'   Got:      {repr(r.actual_output)}')

    return '\n'.join(lines)