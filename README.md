# RapidBay test branch

This branch runs the existing Stream Test Lab on port 3000 and a separate RapidBay service on port 5000.

RapidBay is **not** an IMDb-ID embed API. It is a self-hosted torrent streaming app. It searches through a configured Jackett and/or Prowlarr indexer, then lets you select a video file and stream/transcode it. See the upstream project: https://github.com/hauxir/rapidbay

## Configure before starting

Create or edit `.env` in this directory (do not commit it) and set:

```dotenv
RAPIDBAY_PASSWORD=choose-a-strong-password
JACKETT_HOST=http://your-jackett-host:9117
JACKETT_API_KEY=your-jackett-api-key
# Optional alternative or additional backend:
PROWLARR_HOST=http://your-prowlarr-host:9696
PROWLARR_API_KEY=your-prowlarr-api-key
```

Configure at least one indexer backend (Jackett or Prowlarr). Keep API keys private and do not paste them into chat or commit them to Git.

## Deploy

```bash
cd ~/stream-test
git fetch origin
git switch provider/rapidbay
git pull origin provider/rapidbay
# Edit .env with the values above
docker compose up -d --build
docker compose logs --tail=80 rapidbay
```

- Stream Test Lab: http://YOUR_VPS_IP:3000
- RapidBay: http://YOUR_VPS_IP:5000

RapidBay's search uses torrent/indexer search terms rather than an IMDb ID. Search by title in RapidBay, select the correct video file, and wait for it to download/convert before playback. This branch leaves `main` unchanged.

## Requirements and cautions

- A working Jackett or Prowlarr instance and configured indexers are required for searching.
- RapidBay downloads/streams torrent content and may transcode it; ensure your VPS has enough disk space, CPU and bandwidth.
- Check applicable laws and use only content you are authorized to access.
