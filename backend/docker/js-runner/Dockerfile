FROM node:20-alpine

# No extra packages
COPY run.sh /run.sh
RUN chmod +x /run.sh

WORKDIR /code
ENTRYPOINT ["/run.sh"]
