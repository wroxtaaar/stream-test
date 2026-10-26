# Stream Test — VidSrc.cc

Standalone Node.js and Docker Compose test harness for VidSrc.cc, isolated on `provider/vidsrc-cc`.

## Features
- Search movies and TV series by title using Cinemeta metadata (no API key)
- Select a result to fill the IMDb ID
- Movie and TV episode embeds with season/episode fields
- Embedded player and open-in-new-tab testing
- Health endpoint at `/health`

## Deploy on the VPS

```bash
cd ~/stream-test
git fetch origin
git switch provider/vidsrc-cc
git pull origin provider/vidsrc-cc
docker compose up -d --build
docker compose logs --tail=50 stream-test
```

Open `http://YOUR_VPS_IP:3000`; health check: `http://YOUR_VPS_IP:3000/health`.

The harness constructs VidSrc.cc v2 embed URLs:
- Movie: `https://vidsrc.cc/v2/embed/movie/{id}`
- TV: `https://vidsrc.cc/v2/embed/tv/{id}/{season}/{episode}`

Search may return IMDb IDs; if playback fails, try a numeric TMDB ID. The subtitle dropdown does not change audio language; check the provider player's own audio menu for Hindi tracks. Availability and behavior can change. Test only content you are authorized to access.
