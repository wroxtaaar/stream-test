# Stream Test

This repository contains isolated stream-provider experiments and the original Stream Test app at the repository root.

## Nuvio Streams

The [Nuvio add-on](nuvio/) contains the vendored application source, provider experiments, Docker deployment, and optional Stremio-protocol integrations. It retains the existing host-port mapping and `p2pNotSupported: true` manifest behavior.

See [nuvio/README.md](nuvio/README.md) for deployment, configuration, the Nuvio-only tester at `/nuvio-tester`, and limitations. Optional Magnetio and AIOStreams integrations are disabled unless explicitly enabled and configured with their manifest URLs.
