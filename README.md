# Stream Test — Videasy

Standalone Node.js + Docker Compose harness for testing Videasy embeds. This branch is isolated from `main`.

## Test coverage
- Movie and TV episode embed URL construction
- TMDB numeric IDs and IMDb IDs (`tt...`)
- Autoplay and TV auto-next query parameters
- Default subtitle-language request
- Embedded player and open-in-new-tab comparison
- Manual testing of actual audio tracks, including Hindi where available

## Run on the Oracle VPS

```bash
cd ~/stream-test
git fetch origin
git switch provider/videasy
git pull origin provider/videasy
docker compose up -d --build
docker compose logs --tail=50 stream-test
```

Open `http://YOUR_VPS_IP:3000`; health check: `http://YOUR_VPS_IP:3000/health`.

The default preset is Avengers: Endgame (TMDB ID `299534`). To test TV, choose TV episode and enter a TMDB series ID, season, and episode. A subtitle-language query is not an audio-dubbing switch: inspect the player's actual audio-track menu to verify Hindi audio.

Embed pattern follows the Videasy documentation: `https://player.videasy.ws/embed/movie/{id}` and `https://player.videasy.ws/embed/tv/{id}/{season}/{episode}`. Provider availability, audio tracks, ads, and playback may change. This test harness does not extract stream URLs. Test only content you are authorized to access.
