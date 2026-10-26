# Stream Test Lab — Yenime branch

This branch is an isolated test bench for Yenime's public anime embed. It is intentionally separate from main.

## What it tests

- Yenime anime embeds using a MyAnimeList (MAL) ID and episode number
- SUB mode using the provider's published pattern: https://api.yenime.net/anime/{malId}/{episode}?autoplay=true
- An experimental DUB URL attempt using dub=true. Yenime's public docs advertise SUB/DUB in the player but do not document this URL parameter, so treat it as a test hypothesis, not a guaranteed API feature.
- Quick presets for Death Note (MAL 1535), Naruto (MAL 20), and Frieren (MAL 52991)
- /health endpoint

## Run on the VPS

```bash
git fetch origin
git switch provider/yenime
git pull origin provider/yenime
docker compose up -d --build
docker compose logs --tail=50 stream-test
```

The app keeps the existing Compose service and port mapping. Open http://YOUR_VPS_IP:3000.

## How to test

1. Start with Death Note, episode 1, SUB.
2. Confirm whether the iframe renders and whether playback actually starts.
3. Select DUB and load again. The test bench adds dub=true as an experimental flag; if the player loads but does not switch audio, try any audio selector available inside the provider's own player or open the official demo.
4. Repeat with Naruto or Frieren to separate title-specific failures from provider-wide failures.

A page loading is not proof of playback. Record iframe errors, whether the video starts, and whether the audio track matches the selected mode.

Official provider demo/docs: https://api.yenime.net/

## Notes

- No API key is required by this test bench; it does not call a private API.
- The player and media are hosted by the third-party provider.
- Use only content you are authorized to access.
- Do not expose this test app publicly without access control and HTTPS.
