# Upstream import status

Upstream project: https://github.com/tapframe/NuvioStreamsAddon

The branch currently contains a wrapper and deployment files only, not the full upstream app. To enable actual add-on operation, import and review upstream `server.js`, `addon.js`, `providers/`, `scrapersdirect/`, `utils/`, `views/`, static assets, dependency manifest/lockfile. Do not import personal cookies, `.env`, API secrets, or developer-specific caches. Validate the app's configured port, start command, and routes before exposing it.
