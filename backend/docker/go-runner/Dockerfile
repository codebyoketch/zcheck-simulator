FROM golang:1.22-alpine

RUN apk add --no-cache git

# Pre-fetch and cache z01 at image build time
# This means no network access needed during student code execution
RUN mkdir -p /tmp/prefetch && \
    cd /tmp/prefetch && \
    go mod init prefetch && \
    go get github.com/01-edu/z01@latest && \
    cd / && rm -rf /tmp/prefetch

# Copy entrypoint script
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /code
ENTRYPOINT ["/bin/sh", "/run.sh"]
