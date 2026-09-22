# gate-prep local proxy

A tiny **stateless** forwarder so the browser app can reach Azure AI Foundry
(browsers can't call Foundry directly — CORS blocks it). It stores nothing,
logs no secrets, binds to `127.0.0.1` only, restricts CORS to your app's origin,
answers the Private/Local Network Access preflight, and only forwards to
Azure hosts.

## Build (one-time, needs Go installed)

```bash
cd proxy-exe
go build -o gate-proxy.exe        # Windows
# or:  go build -o gate-proxy     # macOS/Linux
```

No third-party modules — just the Go standard library.

## Run

```bash
./gate-proxy.exe                                   # :8765, any origin
./gate-proxy.exe -port 8765 -origin https://you.github.io
```

The **first time** the web page calls `http://localhost:8765`, Chrome shows a
one-time **"allow local network access"** prompt — click allow. Windows
SmartScreen may also warn about an unsigned exe the first time you run it.

## Contract

`POST /proxy` with JSON:

```json
{ "url": "https://<res>.services.ai.azure.com/…", "method": "POST",
  "headers": { "Authorization": "Bearer <key>", "Content-Type": "application/json" },
  "body": { "...": "provider-specific request" } }
```

→ responds `{ "status": <upstream status>, "body": <upstream json> }`.

The Azure key rides in `headers` **per request** and is never persisted here.
`GET /health` returns `ok`.

## Security notes

- Listens on loopback only (`127.0.0.1`) — not reachable from your network.
- Only forwards to `*.azure.com`, `*.microsoft.com`, `*.services.ai.azure.com`,
  `*.cognitiveservices.azure.com`, `*.openai.azure.com`, `*.azure-api.net`
  (extend with `-allow suffix1,suffix2`).
- Logs only method + hostname, never keys, headers or bodies.
