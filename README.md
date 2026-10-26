# Stremio Add-on Explorer

An isolated test harness for exploring the Stremio add-on protocol. It includes title search via Cinemeta, manifest inspection, and a stream endpoint tester for add-ons you are authorized to test.

## Run

```bash
docker compose up -d --build
```

Open port 3000 and use **Search title**, choose a result, enter an add-on base URL, inspect its manifest, and request streams.

## Notes

- The browser talks directly to the add-on endpoint. Add-ons that do not permit cross-origin requests (CORS) may fail in this tester even if they work in Stremio.
- Movie/series stream IDs use IMDb IDs; episode IDs are formed as `tt...:season:episode`.
- Use only content and add-ons you are authorized to access.
