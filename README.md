# VidCore Stream Resolver Lab

An isolated sandbox for evaluating the VidCore HLS resolver separately from the existing VidSrc test harness. This does not replace the root app and does not change the root `docker-compose.yml`.

## Current state

The source and deployment wiring are contained under `vidcore-resolver/`. The service has a dedicated container name and binds to host port **3002** while listening on container port **3000**.

## Run on the VPS

From the repository root, after pulling the `feature/vidcore-resolver` branch:

```bash
docker compose -f vidcore-resolver/compose.yml up -d --build
docker compose -f vidcore-resolver/compose.yml ps
docker compose -f vidcore-resolver/compose.yml logs --tail=80 vidcore-resolver
curl -fsS http://127.0.0.1:3002/health
```

Open `http://YOUR_VPS_IP:3002` to access the resolver UI.

## Configuration

- `PORT=3000` inside the container; host port defaults to `3002`.
- `VIDCORE_ORIGIN` defaults to `https://vidcore.io`.
- `HOST=0.0.0.0` makes the service reachable through Docker's published port.

Override the host port with `VIDCORE_HOST_PORT=3002` if needed.

## Safety and limitations

This experimental resolver depends on a third-party upstream whose routes, session flow, player code and availability may change without notice. A successful resolve does not guarantee that playback will work. Use only content you are authorized to access, and do not expose this test UI publicly without suitable access controls and HTTPS.

The resolver returns provider-origin media links and may proxy media segments. Treat those URLs as sensitive, ephemeral values; do not log or persist resolved stream tokens longer than necessary.
