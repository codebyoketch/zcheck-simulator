#!/bin/sh
# ZCheck Python Runner
FILE=${1:-solution.py}

# Run with restricted environment
exec python3 -u "/code/$FILE"
