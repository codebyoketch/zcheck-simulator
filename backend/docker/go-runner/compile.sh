#!/bin/sh
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
export GOFLAGS="-mod=mod"

echo "[DEBUG] files in /code:" >&2
ls -la /code/ >&2

if [ -f "/code/main.go" ]; then
    cp /code/main.go "$WORKDIR/main.go"
    cp "/code/$STUDENT_FILE" "$WORKDIR/piscine/$STUDENT_FILE"
    echo "[DEBUG] main.go contents:" >&2
    cat "$WORKDIR/main.go" >&2

    # Piscine module
    cat > "$WORKDIR/piscine/go.mod" <<'EOF'
module piscine

go 1.22
EOF

    # Main module — write go.mod manually with replace directive
    cat > "$WORKDIR/go.mod" <<'EOF'
module solution

go 1.22

require piscine v0.0.0

replace piscine => ./piscine
EOF

else
    cp "/code/$STUDENT_FILE" "$WORKDIR/main.go"
    cat > "$WORKDIR/go.mod" <<'EOF'
module solution

go 1.22
EOF
fi

cd "$WORKDIR"
echo "[DEBUG] WORKDIR contents:" >&2
find "$WORKDIR" -type f >&2
cat "$WORKDIR/go.mod" >&2

# Disable set -e so we can capture the build error ourselves
set +e
BUILD_OUTPUT=$(go build -o /code/bin . 2>&1)
BUILD_EXIT=$?
set -e

echo "[DEBUG] build output: $BUILD_OUTPUT" >&2
echo "[DEBUG] build exit: $BUILD_EXIT" >&2

if [ $BUILD_EXIT -ne 0 ]; then
    echo "$BUILD_OUTPUT"
    exit 1
fi