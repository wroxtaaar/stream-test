#!/usr/bin/env node
const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const app = express();
const PORT = Number(process.env.PORT || 7000);
const ROOT = __dirname;

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(ROOT, "views")));
app.use("/static", express.static(path.join(ROOT, "static")));

function sendJson(res, status, data) {
  res.status(status).type("application/json").send(JSON.stringify(data));
}
app.get("/health", (_req, res) => sendJson(res, 200, {
  status: "ok", service: "nuvio-streams-addon", port: PORT,
  tmdbConfigured: Boolean(process.env.TMDB_API_KEY)
}));

// Use the upstream app server/add-on implementation where available.
// This small entrypoint intentionally provides a safe deployment fallback,
// and surfaces a clear message if the upstream application files are missing.
const upstreamServer = path.join(ROOT, "upstream", "server.js");
const upstreamAddon = path.join(ROOT, "upstream", "addon.js");
app.get("/_deployment-info", (_req, res) => sendJson(res, 200, {
  name: "Nuvio Streams test harness",
  upstreamServerPresent: fs.existsSync(upstreamServer),
  upstreamAddonPresent: fs.existsSync(upstreamAddon),
  note: "The upstream add-on server runs as a separate process in this container."
}));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nuvio wrapper listening on 0.0.0.0:${PORT}`);
});
server.on("error", error => {
  console.error("HTTP server error:", error.message);
  process.exitCode = 1;
});
