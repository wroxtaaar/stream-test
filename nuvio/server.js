#!/usr/bin/env node
const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = Number(process.env.PORT || 7000);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "views")));
app.use("/static", express.static(path.join(__dirname, "static")));

app.get("/health", (_req, res) => res.status(200).json({
  status: "ok",
  service: "nuvio-streams-wrapper",
  port: PORT,
  tmdbConfigured: Boolean(process.env.TMDB_API_KEY)
}));
app.get("/_deployment-info", (_req, res) => res.status(200).json({
  name: "Nuvio Streams deployment wrapper",
  upstreamServerPresent: fs.existsSync(path.join(__dirname, "upstream", "server.js")),
  upstreamAddonPresent: fs.existsSync(path.join(__dirname, "upstream", "addon.js")),
  note: "Wrapper-only status; actual stream resolution is not enabled in this branch yet."
}));
app.get("*", (_req, res) => res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nuvio Streams Test</title>
<style>body{font:16px system-ui;max-width:760px;margin:4rem auto;padding:0 1.2rem;background:#0b1020;color:#eef2ff}a{color:#aab8ff}.note{color:#aeb9d2;border-left:3px solid #8798ff;padding:1rem}</style></head>
<body><h1>Nuvio Streams test container</h1><p>The Docker wrapper is running and reachable.</p><p class="note"><strong>Important:</strong> actual Nuvio stream resolution is not wired into this wrapper yet. This page is not a working stream-provider interface.</p><p><a href="/health">Health</a> · <a href="/_deployment-info">Deployment info</a></p></body></html>`));

app.listen(PORT, "0.0.0.0", () => console.log(`Nuvio wrapper listening on 0.0.0.0:${PORT}`));
