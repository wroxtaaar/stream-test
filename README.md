# Stream Test

A standalone Node.js test harness for evaluating the documented ezvidapi API independently from Torrent Studio.

## Features

- Movie and TV episode testing by TMDB ID
- Loads the API provider list and lets you select a provider
- Shows the provider's raw JSON/text response
- Builds the documented ezvidapi iframe embed
- Attempts to play returned HLS URLs using native HLS or hls.js
- Backend-only provider requests to avoid browser CORS restrictions
- Health endpoint at `/health`

## API endpoints used

The official site documents these endpoints. The JSON API host shown in its examples is `https://api.ezvidapi.com`:

- Movie embed: `https://ezvidapi.com/embed/movie/:tmdb_id`
- TV episode embed: `https://ezvidapi.com/embed/tv/:tmdb_id/:season/:episode`
- Provider list: `GET https://api.ezvidapi.com/list`
- Movie HLS resolution: `GET https://api.ezvidapi.com/movie/:provider/:tmdb_id`
- TV HLS resolution: `GET https://api.ezvidapi.com/tv/:provider/:tmdb_id?season=:season&episode=:episode`

The service may change its API, be unavailable, or return different response shapes. The test UI intentionally shows the raw response so you can verify real behavior instead of assuming playback succeeded.

## Run on the VPS

Requirements: Docker + Docker Compose, or Node.js 20+.

```bash
git clone https://github.com/wroxtaaar/stream-test.git
cd stream-test
docker compose up -d --build
docker compose logs -f stream-test
```

The Compose setup publishes port `10080`. Open:

- UI: `http://YOUR_VPS_IP:10080`
- Health check: `http://YOUR_VPS_IP:10080/health`

If port 10080 is already in use, change the host side of the mapping in `docker-compose.yml`, for example `10081:10080`. Keep the container-side port at `10080`.

Alternatively, run without Docker:

```bash
npm start
```

## Security

- Do not expose this test app publicly without access control and HTTPS.
- Keep the server reachable only from your own network while testing.
- Only test content you are authorized to access.
- Do not commit API credentials or secrets.
