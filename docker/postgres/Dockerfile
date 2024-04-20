# specify version
ARG POSTGRES_VERSION=16

FROM postgis/postgis:${POSTGRES_VERSION}-3.4

# specify version
ENV POSTGRES_VERSION=16

RUN apt-get update \
    && apt-get install -y git \
        build-essential \
        software-properties-common \
        postgresql-server-dev-$POSTGRES_VERSION \
        clang \
        postgresql-$POSTGRES_VERSION-cron

RUN apt-get remove -y git build-essential postgresql-server-dev-$POSTGRES_VERSION && \
    apt-get autoremove --purge -y && \
    apt-get clean && \
    apt-get purge
