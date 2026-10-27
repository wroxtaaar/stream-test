# Nuvio Streams add-on (VPS test)

This branch vendors the source files from [tapframe/NuvioStreamsAddon](https://github.com/tapframe/NuvioStreamsAddon) into this repository under `nuvio/`, with a Docker deployment adjusted for an isolated port. The upstream project was archived; third-party providers may stop working at any time.

## Run on the Oracle VPS

```bash
cd ~
git clone --branch provider/nuvio-streams --single-branch https://github.com/wroxtaaar/stream-test.git
cd ~/stream-test/nuvio
cp .env.example .env
nano .env
```

Set `TMDB_API_KEY` to your own TMDB API key. Do not copy cookies or credentials from public repositories. Then build and run:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 nuvio-streams
curl -fsS http://127.0.0.1:17000/health
curl -I http://127.0.0.1:17000/manifest.json
```

Default landing/configuration UI: `http://YOUR_VPS_PUBLIC_IP:17000/`
Manifest: `http://YOUR_VPS_PUBLIC_IP:17000/manifest.json`

The host port is `17000`; the application listens inside the container on `7000`. If the host port is occupied, change the left-hand side of the mapping in `docker-compose.yml`. Open the chosen port in Oracle Cloud / Ubuntu firewall only if you need public access. For a public service, use HTTPS and access control.

## Useful commands

```bash
docker compose ps
docker compose logs --tail=150 -f nuvio-streams
docker inspect --format '{{json .State.Health}}' stream-test-nuvio-streams
docker compose down
```

`.env`, user cookies and API credentials must remain private. This is a streaming add-on, not a media host; a successful health check confirms only that the server is alive, not that providers return playable sources. Test only content you are authorized to access.

## Source provenance

The `nuvio/` application files originate from upstream Nuvio Streams, distributed under the license included in `nuvio/LICENSE`. The committed upstream `cookies.txt` was intentionally not copied.
