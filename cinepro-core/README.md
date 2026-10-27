# CinePro Core standalone test

This directory runs the official CinePro Core container image directly:
`ghcr.io/cinepro-org/core:latest`. Its published image manifest includes
Linux ARM64. The Core API listens on container port `3000`; Compose publishes
it only at `127.0.0.1:18083` on the VPS.

CinePro Core is an API backend, not a standalone video player. Its OMSS API
and health endpoints are the primary manual test path. The official UI is a
separate project and is not included here. Core requires a valid TMDB API key
for metadata and startup; obtain one from TMDB. The key stays in a local,
ignored `.env` file and is not committed.

The source repository identifies its license as PolyForm Noncommercial
License 1.0.0; review its terms before use.

The official image defaults to the in-memory cache, so no database or Redis
service is needed for this isolated test. Cache contents are not persistent
across restarts; the project documents Redis for persistent/shared production
caching. This setup does not add a data volume because no persistent data path
is needed for the default configuration.

Official references:

- [CinePro Core source](https://github.com/cinepro-org/core)
- [CinePro Core license](https://github.com/cinepro-org/core/blob/main/LICENSE)
- [Official quickstart](https://docs.cinepro.cc/quickstart)
- [Official environment variable documentation](https://docs.cinepro.cc/core/configuration/environment)
- [Official Dockerfile](https://github.com/cinepro-org/core/blob/main/Dockerfile)
- [Official image in GHCR](https://github.com/orgs/cinepro-org/packages/container/package/core)
- [OMSS API reference](https://docs.cinepro.cc/core/api-reference/introduction)

## Get and start on the VPS

Clone the branch into a new folder, create the local environment file, add your
TMDB key, then start CinePro Core:

```bash
git clone --branch cinepro-core https://github.com/wroxtaaar/stream-test.git stream-test-cinepro-core
cd stream-test-cinepro-core/cinepro-core
cp .env.example .env
nano .env
docker compose up -d
```

In VS Code Remote SSH, forward port `18083`. The running image reports `GET /`
as its health check and home/capabilities endpoint. Check it at
`http://127.0.0.1:18083/`. (`/health` is not a route in the current image.)

## Manual checks

Run these commands from the `cinepro-core/` directory:

```bash
docker compose ps
docker compose logs --tail=50 cinepro-core
curl -fsS http://127.0.0.1:18083/
```

For an API smoke test, TMDB ID `961` is [The General (1926)](https://www.themoviedb.org/movie/961-the-general),
a public-domain film. Request its available sources with:

```bash
curl -i --max-time 120 http://127.0.0.1:18083/v1/movies/961
```

This calls CinePro's documented movie-sources endpoint. It may return no
sources if its configured providers do not currently find that title; the
request is not a guarantee of playable results.

Keep the service on its localhost-only binding. Compose limits it to 1 CPU,
768 MiB RAM, and 128 processes. No provider credentials are included or
required by this minimal setup; the TMDB API key is required and must be
supplied privately in `.env`.
