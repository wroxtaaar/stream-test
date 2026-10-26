# Stream Test

A standalone test harness for evaluating streaming providers independently of Torrent Studio.

## First provider: ezvidapi

The first integration targets the publicly documented ezvidapi endpoints:

- Movie player: `GET https://ezvidapi.com/embed/movie/:tmdb_id`
- TV episode player: `GET https://ezvidapi.com/embed/tv/:tmdb_id/:season/:episode`
- Provider list: `GET https://ezvidapi.com/list`
- Movie HLS resolution: `GET https://ezvidapi.com/movie/:provider/:tmdb_id`
- TV HLS resolution: `GET https://ezvidapi.com/tv/:provider/:tmdb_id?season=:season&episode=:episode`

Provider availability and response formats must be tested at runtime; documentation does not guarantee a given title will play or that every URL is a direct media URL.

## Roadmap

1. Add a small provider-test UI for TMDB movie and TV episode IDs.
2. Show provider list, resolved response, and iframe/player preview where supported.
3. Keep integrations isolated behind provider adapters.
4. Add further providers one at a time after recording real test results.
5. Document which providers return direct HLS URLs versus embed/player URLs.

## Safety and deployment

- Never put API secrets in frontend code or commit them.
- Do not expose the test server publicly without access control and HTTPS.
- Only test content you are authorized to access.
