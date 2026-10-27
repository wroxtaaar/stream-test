# AIOStreams isolated VPS test

This folder runs the official AIOStreams container image; it does not vendor or fork the upstream application source. The test is isolated from RapidBay (host port 3000) and CinePro (host port 3001) by using host port **3002**.

Upstream: https://github.com/Viren070/AIOStreams  
Deployment docs: https://docs.aiostreams.viren070.me/getting-started/deployment/

## Start on the VPS

Run these commands from the repository root, `~/stream-test`:

```bash
cd provider-lab/aiostreams
cp .env.example .env
# Generate and insert a private key; this command updates only the local .env file.
sed -i "s/REPLACE_WITH_OUTPUT_OF_OPENSSL_RAND_HEX_32/$(openssl rand -hex 32)/" .env
docker compose up -d
docker compose ps
docker logs --tail 100 stream-test-aiostreams
```

Open `http://YOUR_VPS_IP:3002/stremio/configure` for initial setup if port 3002 is reachable. Alternatively, keep the service private and use an SSH tunnel from your PC:

```bash
ssh -L 3002:127.0.0.1:3002 ubuntu@YOUR_VPS_IP
```

Then open `http://localhost:3002/stremio/configure` on the PC running the tunnel.

## Important

- Never commit `.env`; it contains the encryption key used by AIOStreams. Keep the same key after setup or stored encrypted settings may become unreadable.
- For installing the addon in Stremio from outside localhost, configure a domain and HTTPS, then change `BASE_URL` in `.env` to that HTTPS URL. A plain public HTTP URL is not sufficient for external Stremio addon installation.
- Some upstream addons may block Oracle VPS IP ranges or rate-limit requests. That is separate from whether AIOStreams itself starts successfully.
- The image tag is `latest`; update it deliberately with `docker compose pull && docker compose up -d`.
- This is a standalone test only; it does not change the existing RapidBay or CinePro Compose projects.

## Test and stop

```bash
curl -I http://127.0.0.1:3002/
docker stats --no-stream stream-test-aiostreams
docker compose logs --tail 150
docker compose down
```

The `down` command removes only this AIOStreams container/network; data in `./data` remains.
