# osmium-tool for extracting/clipping/exporting OSM data (pipelines run it with data/ mounted at /data).
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends osmium-tool && rm -rf /var/lib/apt/lists/*
WORKDIR /data
ENTRYPOINT ["osmium"]
