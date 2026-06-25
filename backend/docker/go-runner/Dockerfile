FROM golang:1.22-alpine

RUN apk add --no-cache git

RUN mkdir -p /tmp/prefetch && \
    cd /tmp/prefetch && \
    go mod init prefetch && \
    go get github.com/01-edu/z01@latest && \
    cd / && rm -rf /tmp/prefetch

COPY compile.sh /compile.sh
COPY run.sh /run.sh
RUN chmod +x /compile.sh /run.sh

WORKDIR /code

ENTRYPOINT ["/bin/sh", "/run.sh"]
