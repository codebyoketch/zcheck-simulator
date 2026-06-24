#!/bin/sh
# ZCheck Go Runner
# z01 is pre-cached in the image at build time — no network needed at runtime
set -e

FILE=${1:-solution.go}
WORKDIR="/tmp/sol"

mkdir -p "$WORKDIR"
cp "/code/$FILE" "$WORKDIR/main.go"
cd "$WORKDIR"

# Set up module with z01 (cached in image)
go mod init solution 2>/dev/null
# Point to the cached module — GOFLAGS=-mod=mod allows using cached deps offline
GOFLAGS="-mod=mod" go get github.com/01-edu/z01 2>/dev/null || true
go mod tidy -e 2>/dev/null || true

# Compile
if ! go build -o /tmp/sol_bin . 2>&1; then
  exit 1
fi

# Run — stdin is piped in by the runner
exec /tmp/sol_bin
