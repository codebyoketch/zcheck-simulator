FROM golang:1.22-alpine

WORKDIR /z01
# Copy z01 package source into the image
COPY z01/ .
RUN go build -o /usr/local/lib/z01.a . 2>/dev/null || true

WORKDIR /code

# Copy the entrypoint script
COPY run.sh /run.sh
RUN chmod +x /run.sh

ENTRYPOINT ["/run.sh"]
