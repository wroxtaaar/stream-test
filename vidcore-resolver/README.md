# VidCore Stream Resolver Lab

An isolated sandbox for evaluating the VidCore HLS resolver separately from the existing VidSrc test harness. It does not replace the root app or change the root `docker-compose.yml`.

The resolver source is pinned as a submodule at `vidcore-resolver/upstream`. Initialize it before building.

## Run on the VPS

From the repository root, after switching to the `feature/vidcore-resolver` branch:

```bash
git submodule sync -- vidcore-resolver/upstream
git submodule update --init --depth 1 vidcore-resolver/upstream

docker compose -f vidcore-resolver/compose.yml up -d --build
docker compose -f vidcore-resolver/compose.yml ps
docker compose -f vidcore-resolver/compose.yml logs --tail=80 vidcore-resolver
curl -fsS http://127.0.0.1:3002/
```

Open `http://YOUR_VPS_IP:3002` for the resolver UI.

## Configuration

- Container port: `3000`.
- Host port: `3002` by default. Override using `VIDCORE_HOST_PORT=3002`.
- Upstream origin: `VIDCORE_ORIGIN` (defaults to `https://vidcore.io`).
- The container listens on `0.0.0.0`.

## Safety and limitations

This experimental resolver depends on a third-party upstream whose routes, session flow, player code, and availability may change without notice. Successful resolution does not guarantee playback. Use only content you are authorized to access, and do not expose this test UI publicly without access controls and HTTPS.

The resolver can proxy media and return ephemeral upstream URLs. Avoid logging or persisting resolved stream URLs longer than necessary.
