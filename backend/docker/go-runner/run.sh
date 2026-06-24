#!/bin/sh
# ZCheck Go Runner
set -e

FILE=${1:-solution.go}
WORKDIR="/tmp/sol"

mkdir -p "$WORKDIR"
cp "/code/$FILE" "$WORKDIR/main.go"
cd "$WORKDIR"

# Point Go to the pre-cached module — no network needed
export GOPATH=/go
export GOMODCACHE=/go/pkg/mod
export GOFLAGS="-mod=mod"
export GONOSUMCHECK="*"
export GONOSUMDB="*"
export GOFLAGS="-mod=mod"
export GOPROXY="off"

# Set up module
go mod init solution 2>/dev/null || true
go get github.com/01-edu/z01@v0.1.0 2>/dev/null || true
go mod tidy -e 2>/dev/null || true

# Compile
if ! go build -o /tmp/sol_bin . 2>&1; then
  exit 1
fi

# Run — stdin is piped in by the runner
exec /tmp/sol_bin