ARG POSTGRES_VERSION=16

FROM postgis/postgis:${POSTGRES_VERSION}-3.4

RUN apt-get update && apt-get install -y git build-essential software-properties-common postgresql-server-dev-${POSTGRES_VERSION} clang

RUN git clone https://github.com/citusdata/pg_cron.git

RUN cd pg_cron && make && make install

RUN cd / && \
    rm -rf /pg_cron && \
    apt-get remove -y git build-essential postgresql-server-dev-${POSTGRES_VERSION} && \
    apt-get autoremove --purge -y && \
    apt-get clean && \
    apt-get purge
