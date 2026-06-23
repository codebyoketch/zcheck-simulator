#!/bin/sh
# ZCheck JavaScript Runner
FILE=${1:-solution.js}

exec node "/code/$FILE"
