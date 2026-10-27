# Comet standalone test

This runs Comet directly from its official prebuilt Docker image. The official
`g0ldyy/comet:latest` image publishes a Linux ARM64 image. Comet listens on
container port `8000`; this setup binds it to `127.0.0.1:18082` on the host
only. Its SQLite database is stored under the official `/app/data` mount.

The official deployment uses PostgreSQL by default. For this standalone
manual test, SQLite is selected using Comet's documented `DATABASE_TYPE` and
`DATABASE_PATH` settings, so no database service or credentials are needed.
Comet documents SQLite as suitable for development/testing; it has limited
concurrent-write performance and is not recommended for production workloads.

Official references:

- [Comet Docker setup](https://github.com/g0ldyy/comet/blob/main/docs/beginner/01-get-started-docker.md)
- [Official deployment Compose](https://github.com/g0ldyy/comet/blob/main/deployment/docker-compose.yml)
- [Comet Dockerfile](https://github.com/g0ldyy/comet/blob/main/Dockerfile)
- [Database operations and SQLite notes](https://github.com/g0ldyy/comet/blob/main/docs/advanced/05-database-and-operations.md)
- [Published `g0ldyy/comet:latest` architectures](https://hub.docker.com/r/g0ldyy/comet/tags?name=latest)

## Get and start on the VPS

Clone this branch into a new folder, create its dedicated data directory,
then start Comet:

```bash
git clone --branch comet https://github.com/wroxtaaar/stream-test.git stream-test-comet
cd stream-test-comet/comet
mkdir -p data
docker compose up -d
```

In VS Code Remote SSH, forward port `18082`. Open
`http://127.0.0.1:18082/configure` for Comet's configuration page. The
official health endpoint is `http://127.0.0.1:18082/health`.

## Manual checks

Run these commands from the `comet/` directory:

```bash
docker compose ps
docker compose logs --tail=50 comet
curl -fsS http://127.0.0.1:18082/health
```

The admin dashboard is at `/admin`. If no dashboard password is configured,
Comet generates one at startup and logs it. Keep the service on its localhost
binding; do not expose it publicly without following the project's security
guidance. The `data/` directory contains the persisted SQLite database and
Comet data; keep it when updating or restarting the service.
