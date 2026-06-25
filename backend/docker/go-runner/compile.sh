#!/bin/sh
# Compile only — called once per submission
set -e

FILE=${1:-solution.go}
WORKDIR="/tmp/sol"

mkdir -p "$WORKDIR"
cp "/code/$FILE" "$WORKDIR/main.go"
cd "$WORKDIR"

export GOPATH=/go
export GOMODCACHE=/go/pkg/mod
export GOFLAGS="-mod=mod"
export GONOSUMCHECK="*"
export GONOSUMDB="*"
export GOPROXY="off"

go mod init solution 2>/dev/null || true
go get github.com/01-edu/z01@v0.1.0 2>/dev/null || true
go mod tidy -e 2>/dev/null || true

# Compile binary into /code/bin so host can access it
if ! go build -o /code/bin . 2>&1; then
  exit 1
fi