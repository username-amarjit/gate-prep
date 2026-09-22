# GATE CS/IT — AI Prep

A static, browser-driven study app for GATE CS/IT: a browsable 3-level syllabus
tree (built from the official **GATE 2027** CS syllabus), AI-generated notes with
math + Mermaid diagrams, four reading views, and adaptive Elo quizzing — hosted
free, with a private GitHub repo as the database and a tiny local proxy for
Azure AI Foundry. See [checklist.md](checklist.md) for the full design and
rationale.

## View it right now (zero setup)

Open **[`app/index.html`](app/index.html)** in a browser — double-click it, or
serve the folder:

```bash
# any static server works; e.g. with Python or VS Code Live Server
python -m http.server 5173         # then open http://localhost:5173/app/
```

It boots in **demo mode** with sample notes/questions and the full syllabus, so
you can click around immediately. On the unlock screen choose **Skip (demo)**.
(An internet connection is needed for the CDN libraries: marked, KaTeX, Mermaid,
DOMPurify, js-yaml, hash-wasm.)

## What works in demo mode

- Browse all subjects → topics → learning points (collapsible tree + subject pages)
- Read notes (Markdown + KaTeX math + Mermaid diagrams + `[[wiki-links]]` + prev/next)
- Continuous **book view** in your study-path order, with a sticky table of contents
- **Quiz** with MCQ/MSQ/NAT grading and live Elo rating updates
- **Edit** notes (live preview) and **Generate** notes/questions (demo placeholders)
- **Edit the topic tree** (add/rename/delete subjects, topics, points)
- Search, light/dark theme, IndexedDB cache

## Going live (free)

1. **Two repos:** push this repo as **public** `gate-prep` → enable **GitHub Pages**
   (serves `app/`). Create a **private** `gate-prep-data` for your content.
2. **Proxy:** `cd proxy-exe && go build -o gate-proxy.exe`, then run it with your
   Azure key so it stays on your desktop:
   `$env:AZURE_API_KEY="<key>"; ./gate-proxy.exe`. In the app's Settings, tick
   **"Local proxy supplies the Azure key."** (See its README.)
3. **Azure:** deploy a Claude and/or GPT model in Azure AI Foundry; note the
   base URL + deployment name.
4. **Encrypt your secrets once:** app → **Settings → Create encrypted secrets blob**
   (paste a fine-grained, single-repo, short-lived PAT + a strong passphrase —
   leave the Azure key blank since the proxy holds it) → download `pat.enc.json`
   → commit it to the **public** repo.
5. In **Settings**, set the data repo owner/name, the public `pat.enc.json` URL,
   the proxy URL, the **Foundry base URL** (e.g. `https://<resource>.services.ai.azure.com/anthropic/`)
   and your **Claude deployment name** (e.g. `claude-fable-5`). Unlock with your
   passphrase — from any device — and reads/writes/generation are live. (The app
   posts to `{base}/v1/messages` with `x-api-key` + `anthropic-version`, exactly
   like the `AnthropicFoundry` SDK.)

## Layout

```
app/                 static SPA (no build step; CDN libs)
  index.html
  styles.css
  data/seed.js       demo data + the GATE 2027 syllabus (single source)
  js/                lib, crypto, markdown, elo, store, github, generate, views, app
proxy-exe/           Go stateless localhost proxy for Azure Foundry
content/             on-disk format examples for the private data repo
scripts/build-data.html   regenerate syllabus_tree.json / study_path.json from seed
checklist.md         full architecture + decisions
CS_GATE2027_Syllabus.pdf  source syllabus (IIT Madras)
```

## Security posture (personal project)

- Secrets are pasted once, encrypted under a passphrase (Argon2id + AES-256-GCM),
  and only ever held in memory after unlock. The PAT is fine-grained, single-repo
  and short-lived. The proxy is stateless and localhost-only.
- The encrypted blob is public, so **passphrase strength is everything** — use a
  long passphrase and rotate the PAT on its expiry.
- Rendered Markdown/HTML is sanitized with DOMPurify; a CSP is set in `index.html`.
