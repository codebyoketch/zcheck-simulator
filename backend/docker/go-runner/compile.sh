#!/bin/sh
# Compile only — called once per submission
# Handles two-file Zone01 structure: main.go (platform) + student file (piscine package)
set -e

STUDENT_FILE=${1:-solution.go}
WORKDIR="/tmp/sol"

mkdir -p "$WORKDIR"
mkdir -p "$WORKDIR/piscine"

export GOPATH=/go
export GOMODCACHE=/go/pkg/mod
export GONOSUMCHECK="*"
export GONOSUMDB="*"
export GOPROXY="off"

# ── Case 1: Two-file structure (main_file present) ───────────────────────────
if [ -f "/code/main.go" ]; then
    # main.go goes in root — package main, imports "piscine"
    cp /code/main.go "$WORKDIR/main.go"

    # Student file goes in piscine/ subdir — replace "package piscine" with "package piscine"
    cp "/code/$STUDENT_FILE" "$WORKDIR/piscine/$STUDENT_FILE"

    # Set up piscine submodule
    cd "$WORKDIR/piscine"
    go mod init piscine 2>/dev/null || true
    go get github.com/01-edu/z01@v0.1.0 2>/dev/null || true
    go mod tidy -e 2>/dev/null || true

    # Set up main module with replace directive pointing to local piscine
    cd "$WORKDIR"
    go mod init solution 2>/dev/null || true
    # Add replace directive so "piscine" resolves to ./piscine
    echo 'require piscine v0.0.0' >> go.mod
    echo 'replace piscine => ./piscine' >> go.mod
    go mod tidy -e 2>/dev/null || true

# ── Case 2: Single-file structure (no main.go) ───────────────────────────────
else
    cp "/code/$STUDENT_FILE" "$WORKDIR/main.go"
    cd "$WORKDIR"
    go mod init solution 2>/dev/null || true
    go get github.com/01-edu/z01@v0.1.0 2>/dev/null || true
    go mod tidy -e 2>/dev/null || true
fi

# Compile binary into /code/bin so host can access it
cd "$WORKDIR"
if ! go build -o /code/bin . 2>&1; then
    exit 1
fi