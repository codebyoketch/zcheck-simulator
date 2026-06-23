FROM python:3.12-alpine

# No extra packages — keep it minimal and secure
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /code
ENTRYPOINT ["/run.sh"]
