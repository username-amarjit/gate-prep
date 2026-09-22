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

### Let the proxy hold the Azure key (recommended)

So the key stays on your desktop and never goes into `pat.enc.json` or the
browser, give it to the proxy and tick **"Local proxy supplies the Azure key"**
in the app's Settings:

```bash
# Windows PowerShell
$env:AZURE_API_KEY="<your-foundry-key>"; ./gate-proxy.exe

# or via flag (any OS)
./gate-proxy.exe -azure-key "<your-foundry-key>"
```

When the app sends a request with a `keyHeader` (e.g. `x-api-key`) and no key,
the proxy injects this key into that header. The key is held in memory only and
never logged. `GET /health` returns `{"ok":true,"keyLoaded":true}` so the app
can confirm the key is present.

The **first time** the web page calls `http://localhost:8765`, Chrome shows a
one-time **"allow local network access"** prompt — click allow. Windows
SmartScreen may also warn about an unsigned exe the first time you run it.

## Contract

`POST /proxy` with JSON:

```json
{ "url": "https://<res>.services.ai.azure.com/anthropic/v1/messages",
  "method": "POST",
  "headers": { "content-type": "application/json", "anthropic-version": "2023-06-01" },
  "body": { "model": "claude-fable-5", "max_tokens": 1024, "messages": [] },
  "keyHeader": "x-api-key" }
```

→ responds `{ "status": <upstream status>, "body": <upstream json> }`.

Two ways to supply the Azure key, both keeping it off the public blob:

- **Proxy holds it (recommended):** omit the key from `headers`, set `keyHeader`
  to the header name (`x-api-key` for Claude, `api-key` for GPT); the proxy fills
  it from `AZURE_API_KEY` / `-azure-key`. The key never enters the browser.
- **Browser supplies it:** put the key in `headers` per request and omit
  `keyHeader`.

`GET /health` returns `{"ok":true,"keyLoaded":<bool>}`.

## Security notes

- Listens on loopback only (`127.0.0.1`) — not reachable from your network.
- Only forwards to `*.azure.com`, `*.microsoft.com`, `*.services.ai.azure.com`,
  `*.cognitiveservices.azure.com`, `*.openai.azure.com`, `*.azure-api.net`
  (extend with `-allow suffix1,suffix2`).
- Logs only method + hostname, never keys, headers or bodies.
