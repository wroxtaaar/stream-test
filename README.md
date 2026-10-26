# Stream Test Lab — VidRift branch

Isolated VidRift embed test bench. This branch was created from main and does not modify main or the Yenime experiment.

## Tests

- Movie embed by TMDB ID
- TV episode embed by TMDB ID, season and episode
- Anime embed by AniList ID and episode
- Anime English dub request with `?dub=1`
- Optional player branding and accent color
- Open the generated embed URL in the app or a new tab
- Health endpoint at `/health`

## Deploy on VPS

```bash
git fetch origin
git switch provider/vidrift
git pull origin provider/vidrift
docker compose up -d --build
docker compose logs --tail=50 stream-test
```

Open `http://YOUR_VPS_IP:3000`.

## Test presets

- John Wick (movie, TMDB ID 245891)
- Breaking Bad S1E1 (TV, TMDB ID 1396)
- Attack on Titan E1 (AniList ID 16498)

Anime dub adds `dub=1`. Test that actual audio changes; a URL being accepted is not proof that a dub source is available.

Official docs: https://vidrift.net/

## Notes

- Public VidRift embeds advertise no API key or account requirement.
- Public embeds include an advertisement.
- Playback and available audio tracks vary by title and provider sources; this test bench has not independently verified playback.
- Do not add a sandbox attribute to the iframe.
- Only test content you are authorized to access. Do not expose this test app publicly without access control and HTTPS.
