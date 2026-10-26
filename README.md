# Stream Test

A standalone Node.js VidSrc embed test harness with title search.

## Features

- Search movies and TV series by name using the Cinemeta metadata catalog (no API key required)
- Select a result and load the VidSrc embed player
- Check VidSrc title/episode availability and inspect the raw JSON response
- Supports numeric TMDB IDs and IMDb IDs (`tt...`)
- Health endpoint at `/health`

## Run on the VPS

```bash
git pull
docker compose up -d --build
docker compose logs --tail=50 stream-test
```

The app listens on port `3000`:

- UI: `http://YOUR_VPS_IP:3000`
- Health: `http://YOUR_VPS_IP:3000/health`

**Port note:** if another app already uses port 3000 on this VPS, Docker cannot bind this port until that app is stopped or the host port is changed. Keep the container-side port at `3000`.

## Search notes

Title search uses Cinemeta's public metadata catalog and does not require a TMDB API key. Search results depend on that catalog's availability. VidSrc embeds are provider-hosted; HTTP success or metadata availability does not guarantee playback. This app does not extract direct HLS URLs.

## Security

- Do not expose this test app publicly without access control and HTTPS.
- Only test content you are authorized to access.
- Do not commit API credentials or secrets.
