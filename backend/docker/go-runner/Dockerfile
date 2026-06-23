FROM golang:1.22-alpine

# Install build tools
RUN apk add --no-cache git

# Copy z01 package source (copy your z01 folder here before building)
# If z01 folder doesn't exist, the runner still works for exercises that don't need it
COPY z01/ /z01/
RUN if [ -d "/z01" ] && [ "$(ls -A /z01)" ]; then \
      cd /z01 && go mod init z01 2>/dev/null || true; \
    fi

# Copy entrypoint
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /code
ENTRYPOINT ["/run.sh"]
