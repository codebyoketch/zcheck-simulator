#!/bin/sh
# ZCheck Go Runner
# Usage: docker run --rm -v /path/to/code:/code zcheck-go-runner:latest solution.go
# Reads stdin, compiles and runs the Go file, outputs stdout/stderr

set -e
FILE=${1:-solution.go}
WORKDIR="/tmp/solution"

mkdir -p "$WORKDIR"
cp "/code/$FILE" "$WORKDIR/main.go"
cd "$WORKDIR"

# Initialize module
go mod init solution 2>/dev/null

# If z01 is available as a local package, link it
if [ -d "/z01" ]; then
  echo 'require z01 v0.0.0' >> go.mod
  echo 'replace z01 => /z01' >> go.mod
fi

go mod tidy 2>/dev/null || true

# Compile first to get clean compile errors
if ! go build -o /tmp/solution_bin . 2>/tmp/compile_err; then
  cat /tmp/compile_err >&2
  exit 1
fi

# Run with stdin piped in
exec /tmp/solution_bin
