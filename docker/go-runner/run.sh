#!/bin/sh
# Usage: run.sh solution.go
# Reads stdin, runs the Go file, outputs stdout/stderr
set -e
FILE=${1:-solution.go}
cd /code

# Set up go module with z01 available
if [ ! -f go.mod ]; then
    go mod init solution 2>/dev/null
    # Point to local z01
    echo 'replace z01 => /z01' >> go.mod
    go mod tidy 2>/dev/null || true
fi

go run "$FILE"
