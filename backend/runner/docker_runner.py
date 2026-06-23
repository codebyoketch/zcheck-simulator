"""
Docker-based code execution engine.
ONE container per submission — compiles once, runs all test cases inside it.
"""
import subprocess
import tempfile
import os
import time
from typing import List, Dict
from dataclasses import dataclass, field


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
    """
    Run code against all test cases using a single Docker container.
    Compiles once, executes binary for each test case — no repeated cold starts.
    """
    file_extensions = {'go': 'go', 'python': 'py', 'javascript': 'js'}
    ext = file_extensions.get(language_slug, 'txt')

    with tempfile.TemporaryDirectory() as tmpdir:
        # Write code file
        code_file = f'solution.{ext}'
        with open(os.path.join(tmpdir, code_file), 'w') as f:
            f.write(code)

        # Write all test case inputs as separate files
        for i, tc in enumerate(test_cases):
            with open(os.path.join(tmpdir, f'stdin_{i}.txt'), 'w') as f:
                f.write(tc.get('stdin', ''))

        # Write a runner script that the container will execute
        # This compiles once then runs against each stdin file
        runner_script = _build_runner_script(language_slug, code_file, len(test_cases), timeout_seconds)
        with open(os.path.join(tmpdir, 'runner.sh'), 'w') as f:
            f.write(runner_script)
        os.chmod(os.path.join(tmpdir, 'runner.sh'), 0o755)

        # Launch ONE container
        start = time.time()
        try:
            proc = subprocess.run(
                [
                    'docker', 'run', '--rm',
                    '--memory', memory_limit,
                    '--memory-swap', memory_limit,
                    '--network', 'none',
                    '--read-only',
                    '--tmpfs', '/tmp:size=50m',
                    '--cpus', '0.5',
                    '-v', f'{tmpdir}:/code:ro',
                    '--tmpfs', '/workspace:size=50m',
                    '-w', '/workspace',
                    '--entrypoint', '/bin/sh',
                    docker_image,
                    '/code/runner.sh',
                ],
                capture_output=True,
                timeout=timeout_seconds * len(test_cases) + 30,
            )
        except subprocess.TimeoutExpired:
            return RunResult(
                status='time_limit',
                compile_output=f'❌ Overall time limit exceeded.',
            )
        except Exception as e:
            return RunResult(
                status='runtime_error',
                compile_output=f'Runner error: {str(e)}',
            )

        elapsed_total = int((time.time() - start) * 1000)

        stdout = proc.stdout.decode(errors='replace')
        stderr = proc.stderr.decode(errors='replace')

        # Check for compile error (stderr before any RESULT: lines)
        if proc.returncode != 0 and 'RESULT:' not in stdout:
            return RunResult(
                status='compile_error',
                compile_output=f'❌ Compile error:\n{stderr.strip()}',
            )

        # Parse results — runner outputs: RESULT:<i>:<exit_code>:<output>
        test_results = _parse_results(stdout, test_cases, elapsed_total)

        all_passed = all(r.passed for r in test_results)
        has_tle    = any('timeout' in r.error_output.lower() for r in test_results)

        if all_passed:
            status = 'accepted'
        elif has_tle:
            status = 'time_limit'
        else:
            status = 'wrong_answer'

        compile_output = _build_terminal_output(test_results)

        return RunResult(status=status, compile_output=compile_output, test_results=test_results)


def _build_runner_script(language_slug: str, code_file: str, num_tests: int, timeout: int) -> str:
    """
    Build a shell script that runs inside the container.
    Compiles the code once, then runs against each test stdin file.
    Outputs: RESULT:<index>:<exit_code>:<stdout>
    """
    lines = ['#!/bin/sh', 'set -e', '']

    if language_slug == 'go':
        lines += [
            '# Copy source and set up module',
            'cp /code/solution.go /workspace/main.go',
            'cd /workspace',
            'go mod init solution 2>/dev/null || true',
            'if [ -d "/z01" ] && [ "$(ls -A /z01 2>/dev/null)" ]; then',
            '  echo "require z01 v0.0.0" >> go.mod',
            '  echo "replace z01 => /z01" >> go.mod',
            'fi',
            'go mod tidy 2>/dev/null || true',
            '',
            '# Compile',
            'if ! go build -o /tmp/solution_bin . 2>/tmp/compile_err; then',
            '  cat /tmp/compile_err >&2',
            '  exit 1',
            'fi',
            '',
        ]
        run_cmd = '/tmp/solution_bin'

    elif language_slug == 'python':
        lines += [
            'cp /code/solution.py /workspace/solution.py',
            '# Verify syntax',
            'if ! python3 -m py_compile /workspace/solution.py 2>/tmp/compile_err; then',
            '  cat /tmp/compile_err >&2',
            '  exit 1',
            'fi',
            '',
        ]
        run_cmd = 'python3 -u /workspace/solution.py'

    elif language_slug == 'javascript':
        lines += [
            'cp /code/solution.js /workspace/solution.js',
            '',
        ]
        run_cmd = 'node /workspace/solution.js'

    else:
        run_cmd = f'cat /code/{code_file}'

    # Run against each test case
    lines += ['# Run test cases']
    for i in range(num_tests):
        lines += [
            f'OUTPUT_{i}=$(timeout {timeout} {run_cmd} < /code/stdin_{i}.txt 2>/tmp/stderr_{i} ; echo "EXIT:$?")',
            f'EXIT_{i}=$(echo "$OUTPUT_{i}" | grep "EXIT:" | tail -1 | cut -d: -f2)',
            f'OUT_{i}=$(echo "$OUTPUT_{i}" | grep -v "EXIT:" )',
            f'ERR_{i}=$(cat /tmp/stderr_{i} 2>/dev/null || echo "")',
            f'echo "RESULT:{i}:$EXIT_{i}:$OUT_{i}"',
            f'echo "STDERR:{i}:$ERR_{i}"',
            '',
        ]

    return '\n'.join(lines)


def _parse_results(stdout: str, test_cases: List[Dict], elapsed_total: int) -> List[TestCaseResult]:
    results = []
    outputs = {}
    errors  = {}

    for line in stdout.splitlines():
        if line.startswith('RESULT:'):
            parts = line.split(':', 3)
            if len(parts) >= 4:
                idx     = int(parts[1])
                exit_c  = parts[2].strip()
                out     = parts[3].strip()
                outputs[idx] = (exit_c, out)
        elif line.startswith('STDERR:'):
            parts = line.split(':', 2)
            if len(parts) >= 3:
                idx = int(parts[1])
                errors[idx] = parts[2].strip()

    avg_ms = elapsed_total // max(len(test_cases), 1)

    for i, tc in enumerate(test_cases):
        exit_c, actual = outputs.get(i, ('1', ''))
        err = errors.get(i, '')
        expected = tc['expected_output'].strip()
        passed = (actual == expected) and exit_c == '0'

        if 'timeout' in err.lower() or exit_c == '124':
            err = f'Time limit exceeded'
            passed = False

        results.append(TestCaseResult(
            test_case_id=tc['id'],
            order=tc['order'],
            passed=passed,
            actual_output=actual,
            error_output=err,
            execution_time_ms=avg_ms,
            is_hidden=tc['is_hidden'],
        ))

    return results


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
