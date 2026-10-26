# RapidBay + Torrent Studio Search test branch

This branch keeps Stream Test Lab on port 3000 and builds RapidBay from source for the ARM64 VPS on port 5000.

## What changed

- RapidBay is built from pinned upstream source rather than the upstream AMD64-only image.
- A small 1337x search adapter based on Torrent Studio's torrent-search approach is patched into RapidBay. It searches titles and returns torrent detail links to RapidBay, which uses its existing flow to resolve a magnet and stream selected content.
- Jackett and Prowlarr remain optional additional search backends.
- This is an experimental adapter, not a wholesale copy of Torrent Studio's backend. 1337x availability, page layout, and VPS network access can affect results. The first build and live search still need testing.
- The upstream x86-64-only ALASS binary is omitted; subtitle synchronization features depending on it may be unavailable.

## Configure

In `~/stream-test/.env`, set a strong RapidBay password. Jackett/Prowlarr variables are optional when the built-in 1337x adapter is enabled.

```dotenv
RAPIDBAY_PASSWORD=choose-a-strong-password
# Optional additional providers:
JACKETT_HOST=
JACKETT_API_KEY=
PROWLARR_HOST=
PROWLARR_API_KEY=
```

Do not commit credentials.

## Deploy on the Oracle VPS

```bash
cd ~/stream-test
git fetch origin
git switch provider/rapidbay-torrent-studio-search
git pull origin provider/rapidbay-torrent-studio-search
```

Check that `.env` contains `RAPIDBAY_PASSWORD`, then build and start only RapidBay first:

```bash
docker compose build --no-cache rapidbay
docker compose up -d rapidbay
docker compose logs --tail=120 rapidbay
```

- Stream Test Lab: `http://YOUR_VPS_IP:3000`
- RapidBay: `http://YOUR_VPS_IP:5000`

Log in with the password configured in `.env`, search a title, and check the results. If the build fails, share the first actual error from the build log before changing other services.

Use only torrents for content you are authorized to access.
