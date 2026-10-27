# Stream Test

A standalone Node.js VidSrc embed test harness with title search, plus an isolated VidCore resolver lab.

## Existing VidSrc app

The existing root app remains unchanged. It listens on port `3000`.

- UI: `http://YOUR_VPS_IP:3000`
- Health: `http://YOUR_VPS_IP:3000/health`

## VidCore resolver lab

The VidCore test setup is isolated in `vidcore-resolver/`, with its own compose file and host port **3002**. It does not modify or replace the root VidSrc app or the root `docker-compose.yml`.

After checking out this branch on the VPS, initialize the pinned upstream source and run the separate service:

```bash
git submodule sync -- vidcore-resolver/upstream
git submodule update --init --depth 1 vidcore-resolver/upstream
docker compose -f vidcore-resolver/compose.yml up -d --build
docker compose -f vidcore-resolver/compose.yml ps
docker compose -f vidcore-resolver/compose.yml logs --tail=80 vidcore-resolver
```

Open `http://YOUR_VPS_IP:3002`.

For details, see [VidCore resolver lab README](vidcore-resolver/README.md).

## Notes

Title search for the existing VidSrc app uses Cinemeta's public metadata catalog. Provider embeds and resolver availability depend on third-party services and do not guarantee playback.

Do not expose either test app publicly without appropriate access control and HTTPS. Use only content you are authorized to access, and do not commit credentials or secrets.
