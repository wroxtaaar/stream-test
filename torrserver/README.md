# TorrServer standalone test

This directory runs TorrServer directly from the official GHCR image. The
official Dockerfile stores its config and logs under `/opt/ts/config` and
`/opt/ts/log`, and torrent data under `/opt/ts/torrents`; mounting `./data`
at `/opt/ts` persists all of them. The service uses the default web/API port
8090 inside the container and is published only on host loopback port 18081.

The official `MatriX.147.1` release is used. TorrServer's official Docker
workflow publishes `linux/arm64` images. Sources:

- [Official TorrServer Docker instructions](https://github.com/YouROK/TorrServer#running-in-docker--docker-compose)
- [Official Dockerfile](https://github.com/YouROK/TorrServer/blob/master/Dockerfile)
- [Official multi-architecture image workflow](https://github.com/YouROK/TorrServer/blob/master/.github/workflows/docker_image.yml)
- [MatriX.147.1 release](https://github.com/YouROK/TorrServer/releases/tag/MatriX.147.1)

## Get and start on the VPS

Clone this branch into a new folder, create its dedicated data directory, and
start the service:

```bash
git clone --branch torrserver https://github.com/wroxtaaar/stream-test.git stream-test-torrserver
cd stream-test-torrserver/torrserver
mkdir -p data
docker compose up -d
```

In VS Code Remote SSH, forward port `18081` to access the local-only service.
Open `http://127.0.0.1:18081/` for the TorrServer UI. The official project
documents this root web UI; this setup does not assume a separate `/health`
route.

## Manual checks

Run these from the `torrserver/` directory:

```bash
docker compose ps
docker compose logs --tail=50
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:18081/
```

Compose limits the container to 1 CPU, 768 MiB RAM, and 128 processes. The
`data/` directory contains TorrServer configuration, logs, and torrent data;
keep it when updating or restarting the container.
