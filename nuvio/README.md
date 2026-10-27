# Nuvio Streams test deployment

This folder contains a containerized copy of [tapframe/NuvioStreamsAddon](https://github.com/tapframe/NuvioStreamsAddon) for isolated VPS testing.

## Requirements

- Docker Engine and Docker Compose plugin
- A TMDB API key for movie/TV metadata
- Use only sources/content you are authorized to access

## Run

```bash
cd ~/stream-test/nuvio
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 nuvio-streams
```

Set `TMDB_API_KEY` in `.env`. The container listens on port 7000; by default, the VPS host port is 17000. Open:

- UI / add-on landing page: `http://YOUR_VPS_IP:17000/`
- Manifest: `http://YOUR_VPS_IP:17000/manifest.json`

If port 17000 is in use, set `NUVIO_HOST_PORT=17001` before starting. If using a cloud firewall, only open the chosen port if you intend to access it remotely. For a public deployment, put it behind HTTPS and access control; do not expose secrets or personal cookies.

## Health checks

```bash
curl -i http://127.0.0.1:17000/
curl -i http://127.0.0.1:17000/manifest.json
docker inspect --format '{{json .State.Health}}' stream-test-nuvio-streams
```

The included upstream project is archived. A successful container start does not guarantee that third-party providers currently resolve streams. Provider availability and regional access can change.

## Updating

```bash
git pull --ff-only
cd nuvio
docker compose up -d --build
```

`.env` and `cookies.txt` must remain local and should never be committed.
