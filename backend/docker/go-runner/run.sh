#!/bin/sh
# Run only — called once per test case with pre-compiled binary
set -e

# Run the pre-compiled binary — stdin is piped in by the runner
exec /code/bin