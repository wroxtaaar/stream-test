# Nuvio Streams test deployment

This folder is a separate Docker deployment target for [Nuvio Streams](https://github.com/tapframe/NuvioStreamsAddon), independent of the existing Stream Test app.

> **Status:** This branch currently contains a runnable container wrapper and deployment configuration, not the complete upstream add-on/provider code. It does not resolve streams yet. `/health` checks the wrapper only. The upstream repository is archived, so provider functionality must be audited and tested before use.

## Deploy on the VPS

```bash
cd ~/stream-test/nuvio
cp .env.example .env
nano .env  # Set TMDB_API_KEY if available
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:17000/health
curl -fsS http://127.0.0.1:17000/_deployment-info
```

Default wrapper URL: `http://YOUR_VPS_IP:17000/`. The container listens on port 7000; host port 17000 is published by Compose. Change the left-hand side of the port mapping if 17000 is occupied.

## Logs and stop

```bash
docker compose logs --tail=100 -f nuvio-streams
docker compose down
```

Keep `.env`, cookies and credentials private. For remote access use HTTPS and access control. Only access content you are authorized to access.
