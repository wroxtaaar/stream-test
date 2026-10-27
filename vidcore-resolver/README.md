# VidCore Stream Resolver — isolated test

This folder packages the third-party fork [sharoon7171/vidcore-io-stream-resolver](https://github.com/sharoon7171/vidcore-io-stream-resolver). It is **not verified as the official VidCore project**. The upstream repository's license status should be checked before use or redistribution; no license was confirmed during setup.

The app's README describes a Node.js/TypeScript web UI, HLS browser player, NDJSON resolver API, and VLC/MPV exports. This Docker wrapper has not been built or run on the maintainer's VPS yet, so do not interpret the files as proof that upstream resolution or playback works.

## Run

Requires Docker Engine with Compose and a checkout of this branch.

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 vidcore-resolver
curl -I http://127.0.0.1:18084/
```

Open the UI through an SSH tunnel to port 18084, then visit `http://127.0.0.1:18084/`.

## API examples

Based on the upstream README; these contact the upstream provider when executed:

```bash
curl -N "http://127.0.0.1:18084/api/resolve?type=movie&id=550&server=Orbit"
curl -N "http://127.0.0.1:18084/api/resolve?type=tv&id=1399&season=1&episode=1&server=Supreme"
```

The API returns newline-delimited JSON. Movie/TV IDs are TMDB IDs. Available mirrors depend on upstream responses.

## Notes and limitations

- Host port is bound only to `127.0.0.1:18084`; it is not published publicly.
- Container listens on port 3000.
- Docker's Node base image supports ARM64, but the full application build still needs to be tested on the target VPS.
- The container uses a read-only root filesystem, drops Linux capabilities, and has a 512 MiB memory limit. If the app requires writable paths, diagnose and add only the narrowest required writable mount.
- This tool fetches pages and stream URLs from third-party services. Inspect upstream code and dependencies before running; do not add credentials or expose it publicly.
- Use only content you are authorized to access and follow applicable law and upstream terms.
- Successful HTTP responses do not guarantee playback, seeking, or quality selection.

## Stop and remove this test

```bash
docker compose down
docker image rm vidcore-resolver-test:local
```
