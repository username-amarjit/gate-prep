# GATE CS/IT AI Prep System — Build Checklist (v3: two repos, GitHub Pages, local proxy exe)

Tailored to: GATE CS/IT · comfortable coding solo · **free hosting** · read/quiz from any device · generate at your Windows desk · 3-6 months to exam.

**Timeline reality check:** with 3-6 months you can't spend weeks building before studying starts. Front-load a **~2-week build sprint** to a working v1, then study *using* the tool while extending it — note and question generation are themselves study activities, so it isn't pure overhead.

---

## Architecture at a glance (and why)

A **static single-page app** served free from a **public** repo on GitHub Pages, with a **private** repo acting as the database (flat files, reached with a passphrase-unlocked token that's stored once as an encrypted blob), and a **local Windows exe** as the only "server" — it exists solely because browsers can't call Azure directly.

```
   BROWSER  (read/quiz anywhere)                 WINDOWS DESKTOP  (generate only here)
 ┌─────────────────────────────┐   localhost   ┌───────────────────────────────┐
 │ Static SPA                  │  {key,prompt} │ Local proxy exe               │
 │ GitHub Pages (PUBLIC repo)  │ ─────────────▶│ - generic, NO baked secret    │
 │ - passphrase unlocks stored │               │ - adds CORS + Local Network   │
 │   PAT (+ key); RAM only     │ ◀─────────────│   Access handling             │
 │ - Mermaid + KaTeX render    │   response    │ - forwards to Azure, logs none│
 └──────────┬──────────────────┘               └───────────────┬───────────────┘
            │ GitHub API (CORS ok; pasted PAT)                  ▼
            ▼                                    ┌───────────────────────────────┐
 ┌─────────────────────────────┐                │ Azure AI Foundry (serverless)  │
 │ PRIVATE data repo = DATABASE│                │ Claude + GPT deployments       │
 │ notes/*.md  questions/*.json│                └───────────────────────────────┘
 │ assets/  index.json         │
 └─────────────────────────────┘
```

- **Read/browse/quiz** path: browser → GitHub API → private data repo. Works on **any device**.
- **Generate** path: browser → local exe → Azure. Works **only on the Windows machine running the exe**.

**Decisions locked (confirmed Sep 2026):**
- [ ] **Models: Azure AI Foundry (Microsoft Foundry).** Claude (Opus/Sonnet/Haiku/Fable) + GPT, serverless pay-per-token, one Azure bill. ⚠️ Inference is **paid** — the only non-free piece (~$20-30 total at this scale; Azure free credits may cover early use).
- [x] **Hosting: two repos.** `gate-prep` **public** → free **GitHub Pages** (the app shell + exe source); `gate-prep-data` **private** → the content database, read/written at runtime with a pasted PAT. *GitHub Secrets can't help here — they're build-time only, and anything a static public page can read the public can read, so the PAT is pasted, never embedded.*
- [x] **Azure proxy: a local Windows exe.** Browsers can't call Foundry directly (CORS blocks it before the request leaves the machine). A generic local proxy on `localhost` forwards the calls — **no request/day limits, no size caps, no third party, no baked secret**. ⚠️ Consequence: **note generation is desktop-only** (the exe must be running); reading/quizzing works anywhere.
- [x] **Secrets: store once, unlock anywhere.** Your PAT (and optionally the Azure key) are encrypted **once** under a **passphrase** into a blob committed to the **public** app repo; on any device you type the passphrase to decrypt, and the plaintext lives in memory for that session only. ⚠️ The blob is publicly downloadable, so the passphrase is the sole guard — mandatory: **strong passphrase + Argon2id KDF + AES-256-GCM + a short-lived PAT scoped to the data repo only** (see Key management). No raw secret is ever stored or baked.
- [ ] **No server database.** The private repo (flat files) is the source of truth; the browser's IndexedDB is only a rebuildable cache.
- [ ] **Frontend stack:** lightweight — Vite + Svelte or React (static build). No SSR (nothing runs server-side).

---

## Content model & repo layout

The private repo IS the database. Notes are markdown; questions/PYQs are JSON; both embed rich content the same way.

```
gate-prep/                        # PUBLIC repo → GitHub Pages
├── app/                          # static SPA source
├── proxy-exe/                    # local Windows proxy (Go/Rust/.NET single-file)
└── scripts/                      # local utilities (seed, validate, rebuild cache)

gate-prep-data/                   # PRIVATE repo → the database (reached with pasted PAT)
├── syllabus_tree.json            # topic hierarchy (main → sub → learning point)
├── index.json                    # manifest: tree + inventory of notes/questions (fast load)
├── study_path.json               # YOUR curated linear read-order (ordered node_id list)
├── notes/
│   └── <subject>/<sub>/<learning-point>/
│        ├── note.md              # markdown + YAML frontmatter
│        └── assets/              # svg / png / .excalidraw for THIS note
└── questions/
     └── <subject>/<sub>/<learning-point>/
          ├── q-<id>.json         # one question/PYQ per file
          └── assets/
```

### Note format — Markdown + YAML frontmatter
```markdown
---
node_id: toc.regular-languages.pumping-lemma
title: Pumping Lemma for Regular Languages
level: learning_point            # main_topic | subtopic | learning_point
order: 3                         # position among siblings (natural reading order)
status: draft                    # draft | verified
rating: 1200                     # your Elo on this node
model: claude-opus-via-foundry
created: 2026-09-22
updated: 2026-09-22
assets: [assets/dfa.svg]
prereqs: [toc.regular-languages.dfa-nfa]    # read these before this one
related: [toc.regular-languages.closure]    # see-also cross-links
---

Body in markdown. Math via KaTeX: $L=\{a^n b^n\}$.
Cross-link to any other note with a wiki-link: [[toc.regular-languages.dfa-nfa]].
Diagrams via Mermaid (renders on GitHub + in-app):

```mermaid
stateDiagram-v2
  [*] --> q0
  q0 --> q1: a
  q1 --> q1: b
```
```

### Diagram/table storage (tiered — prefer text, fall back to files)
- [ ] **Mermaid** (inline) for state machines, ER, flowcharts, trees/graphs, sequences — text, diffable, native render.
- [ ] **KaTeX** for all math.
- [ ] **Markdown/HTML tables** for tables.
- [ ] **SVG asset files** when Mermaid can't express it (circuits, custom figures).
- [ ] **Excalidraw** for hand-drawn figures — store `.excalidraw` JSON + exported `.svg`.
- [ ] **PNG/JPG** last resort (scanned PYQ figures, photos).
- [ ] **Linking:** asset files + **relative links** as the default; commit note + its assets in **one commit via the Git Data API** (blobs → tree → commit → ref). Inline base64 data URIs only for *tiny* SVGs.
- [ ] Each node gets its own folder so note + assets colocate.

### Navigation, linking & sequencing
Reading order is driven by the tree plus explicit metadata, so you always know "what to read after what":
- [ ] **Sibling order** — `order` in frontmatter sets sequence within each parent (natural syllabus order).
- [ ] **Custom study path** — `study_path.json` is an ordered list of `node_id`s defining YOUR cross-tree read-order (may differ from syllabus); falls back to depth-first tree order when absent.
- [ ] **Prerequisites** — `prereqs` expresses "read X before Y"; the app can topologically sort a suggested order and warn on cycles.
- [ ] **Cross-links** — `[[node_id]]` in any note body links to that note; `related` lists see-also nodes.

Four reading views (built in Phase 4):
1. **All subjects** — collapsible 3-level tree of everything.
2. **Subject page** — only that subject's topics; click a topic → its note.
3. **Note page** — the note + prev/next (from the study path) + prereq/related chips + inline `[[wiki-links]]`.
4. **Continuous "book" view** — all notes (or one subject) concatenated in your defined sequence, with a sticky table of contents.

### Question / PYQ format — JSON (rich fields are markdown)
Fields: `id, node_id, type (MCQ|MSQ|NAT), source (PYQ:year | generated), difficulty_elo, stem_md, options[], answer, solution_md, assets[], tags[], model, verified`. Images/diagrams/math inside `stem_md`/`solution_md`/options reuse Mermaid/KaTeX/asset refs.

---

## Key management — store once, unlock anywhere

You enter secrets **once**, then unlock with a passphrase on any device. Because the encrypted blob lives in the **public** app (so a brand-new device can fetch it with no token), the passphrase is the *only* thing protecting it — so the crypto and token scope below are non-negotiable.

**Encrypted blob** `pat.enc.json` (committed to the public `gate-prep` repo, served by Pages):
```json
{
  "v": 1,
  "kdf": "argon2id",
  "params": { "m": 262144, "t": 3, "p": 1 },   // ~256 MB, memory-hard
  "salt": "<base64>", "iv": "<base64>",
  "ciphertext": "<base64>",                      // AES-256-GCM( { pat, azure_key? } )
  "pat_expires": "2026-12-21"                    // drives an in-app rotation reminder
}
```

- [ ] **One-time setup (desktop):** paste the fine-grained PAT (+ optionally the Azure key) → choose a **strong passphrase** → derive a key with **Argon2id** (WASM lib, e.g. hash-wasm) → **AES-256-GCM** encrypt → produce `pat.enc.json`.
- [ ] Commit `pat.enc.json` to the **public** repo (drop it in + `git push`, or let the app commit it *only if* you also scope the PAT to the app repo — otherwise keep the PAT to the data repo only and commit the file manually).
- [ ] **Unlock (any device):** app fetches `pat.enc.json` from the public Pages URL → you type the passphrase → Argon2id + AES-GCM decrypt → secrets held in memory/`sessionStorage` for the session. A wrong passphrase simply fails the GCM auth tag (no false unlock).
- [ ] **Rotation:** use a **short-lived** PAT (≤ 90 days). On expiry, reads fail → re-run setup with a fresh token; the `pat_expires` field powers a "rotate your token" reminder.
- [ ] **Brute-force posture:** enforce a strong passphrase (min length / zxcvbn score); Argon2id makes each guess expensive; the short-lived, single-repo PAT bounds the damage window and blast radius if the passphrase is ever cracked.

---

## Phase 0 — Skeleton (Day 1-2)

- [ ] Create **two repos**: `gate-prep` (**public** — app + exe source) and `gate-prep-data` (**private** — content). Enable **GitHub Pages** on the public repo.
- [ ] Scaffold the static SPA (Vite + Svelte/React); deploy "hello world" to GitHub Pages.
- [ ] Confirm the deployed URL loads on your phone and another machine (proves "open it anywhere" for reading).
- [ ] Add a **settings/unlock panel**: first-time **setup** (paste PAT + Azure key, set passphrase → encrypt → produce `pat.enc.json`); everyday **unlock** (enter passphrase → decrypt); set the **local proxy URL** (`http://localhost:<port>`); a "lock" button clears decrypted secrets. See Key management.
- [ ] **Checkpoint:** on a *second* device, entering the passphrase alone unlocks the app (no token pasting), and secrets clear on lock/tab-close.

## Phase 1 — Topic tree (main → subtopic → learning point) (Day 2-3)

- [ ] Download the current official **GATE CS/IT syllabus** (host IIT rotates yearly — search "GATE 2027 CS syllabus").
- [ ] Transcribe into `syllabus_tree.json`: every node has `id`, `title`, `level` (`main_topic`/`subtopic`/`learning_point`), `parent_id`, `order`. Subjects: Engineering Math, Digital Logic, COA, Programming & DS, Algorithms, ToC, Compiler Design, OS, DBMS, Computer Networks, Discrete Math.
- [ ] Build `index.json` from the tree (tree + empty inventory) so the app can render the browser instantly.
- [ ] SPA: render the 3-level tree — **all-subjects view** plus **drill into a single subject** — with per-node coverage badges (notes, questions/PYQs, rating).
- [ ] **Checkpoint:** browse the full tree and open one subject's topics in the deployed app.

## Phase 2 — GitHub read/write layer (Day 3-5)

- [ ] **Read** `content/**` from the **private data repo** via GitHub REST using the pasted PAT. Cache in memory/IndexedDB. (The public app repo needs no token.)
- [ ] **Write:** commit to the private data repo via the **Git Data API** (blobs → tree → commit → update ref) so a note + its assets + `index.json` land atomically in one commit.
- [ ] Use a **fine-grained PAT** scoped to **the data repo only**, Contents: read/write — nothing else. Document how to create it in the app's help.
- [ ] Handle the update case: refresh the ref/SHA before committing to avoid conflicts; surface a clear "changed upstream, reload" message.
- [ ] **Checkpoint:** from the deployed app, create a test note in the private repo and see the commit appear; reload on another device and read it back.

## Phase 3 — Local proxy exe + generation (Day 5-7)

- [ ] Build the **local proxy exe** (Go/Rust/.NET single-file, Windows): an HTTP server on `127.0.0.1:<port>` that accepts `{provider, key, payload}`, forwards to the matching Foundry deployment (Claude via Messages API, GPT via the OpenAI-style endpoint), returns the response, adds **CORS headers** for your Pages origin, and handles Chrome's **Local Network Access** prompt. **No secret is compiled in** — the key arrives per request from the browser (or from a local config/env var if you prefer). Logs/stores nothing.
- [ ] Ship the exe as a download (GitHub Release on the public repo); document the one-time "allow local network access" prompt and Windows SmartScreen.
- [ ] SPA generation module: one abstraction, two backends (`claude`, `gpt`), routed by task (e.g., Claude for notes, GPT for question variety), pointed at the local proxy URL.
- [ ] Write the **note-generation prompt** (target GATE depth); generate for **5 nodes first**, read them manually for accuracy/depth before scaling.
- [ ] Generation → **write path**: build `note.md` (+ any assets) and commit to the private data repo via Phase 2, then update `index.json`. The commit is the durable copy; IndexedDB updates as cache.
- [ ] **Checkpoint:** with the exe running on your desktop, generate a note in the browser → it commits to the private repo → appears in the tree with a `draft` badge → renders (Mermaid + KaTeX). Confirm generation degrades gracefully when the exe isn't running.

## Phase 4 — Notes UX (Day 7-9)

- [ ] View note: render markdown + Mermaid + KaTeX + tables + asset images.
- [ ] Edit note: save = new commit; editing resets `status` to `draft`; keep git history as the version trail (no custom versioning needed).
- [ ] Regenerate: clarifying-input flow (too shallow / too abstract / different angle) → new generation → commit.
- [ ] Asset upload: drag-drop image/SVG → committed as a blob in the note's `assets/`, relative link inserted.
- [ ] Build the **four reading views** (all-subjects tree / subject page / note page / continuous book view — see content model).
- [ ] Note page: **prev/next** from the study path, **prereq/related chips**, and rendered `[[node_id]]` wiki-links.
- [ ] **Study-path editor:** drag-reorder nodes to define `study_path.json`; commit on save.
- [ ] **Checkpoint:** end-to-end edit/regenerate/asset-insert, plus navigate a subject in sequence via prev/next and the book view — all landing as commits and readable elsewhere.

## Phase 5 — Questions/PYQs + Elo quiz (Day 9-12)

- [ ] Source PYQs (GATE Overflow has 20+ years tagged by subject — big head start). Import 5-10 per node as `q-*.json`, mapping each to a `node_id` (LLM suggests the node, you approve).
- [ ] Question generation: node + its notes + its PYQs → new question + worked solution, seeded at Elo 1200; second-pass **scope-verification** LLM call to flag out-of-scope generations.
- [ ] Elo module in the SPA: two-pool update as pure, unit-tested functions (~30-40 lines) before wiring in.
- [ ] Quiz flow: pick weakest + decay-due nodes → serve question (renders images/math) → accept answer → update Elo → wrong answer links back to the note. Store attempts as JSON commits (or IndexedDB + periodic commit).
- [ ] **Checkpoint:** browse tree → read note → quiz → answer → rating changes → wrong answer links to note. **This is v1 done.**

## Phase 6 — Authoring the topic tree from the webpage (Day 12-13)

- [ ] Full CRUD on `syllabus_tree.json` from the app: add/rename/move/delete **main topics, subtopics, learning points**; each change commits the updated tree + `index.json` to the private repo.
- [ ] Guard rails: prevent orphaning children on delete; confirm destructive actions.
- [ ] **Checkpoint:** add a new learning point in the UI → it commits → reload elsewhere → new node present, ready for note/question generation. (Works because every "write" is a GitHub commit; requires a valid pasted PAT.)

## Phase 7 — Client cache, offline & rebuild (Day 13-14)

- [ ] IndexedDB cache hydrated from the private repo's `content/**`; app reads cache first, revalidates against GitHub.
- [ ] "Rebuild cache from repo" button — proves the cache is disposable and the files are canonical (this is your "restore" story, now client-side).
- [ ] Optional: service worker for offline read of already-cached notes.
- [ ] **Checkpoint:** clear IndexedDB → app rebuilds entirely from repo files with no data loss.

---

## Security checklist (protecting YOUR GitHub account + Azure key — not org data)

Personal, non-confidential study data, so no Adobe/org security review applies. The real risks are your **GitHub PAT** or **Azure key** leaking — keep the blast radius tiny:

- [ ] **Fine-grained, short-lived PAT** scoped to **the data repo only** (Contents: read/write, ≤ 90-day expiry) — bounds the blast radius and the window if the passphrase is ever cracked.
- [ ] **Public ciphertext → passphrase is the only guard:** enforce a **strong passphrase** (min length / zxcvbn), derive with **Argon2id** (memory-hard), encrypt with **AES-256-GCM**, fresh random salt + IV per blob.
- [ ] **Decrypted secrets in memory only:** after unlock, hold PAT/Azure key in memory (or `sessionStorage`), cleared on lock/tab-close — never written back in plaintext, never in `localStorage` or the exe binary.
- [ ] **Local proxy exe:** binds to `127.0.0.1` only (never `0.0.0.0`), restricts CORS to your Pages origin, handles the Local Network Access prompt, logs/stores nothing, holds the key only for the in-flight request.
- [ ] Strict **Content-Security-Policy** + sanitize rendered markdown/HTML — an XSS bug would leak the decrypted in-memory secrets.

---

## Enhancements worth adding

- [ ] **Two-model cross-check:** generate a note with Claude, have GPT critique/flag errors (or vice versa) — cheap accuracy boost using both Foundry deployments.
- [ ] **Coverage dashboard:** nodes with no notes / thin PYQs / lagging ratings, per subject — drives study-time rebalancing.
- [ ] **Spaced-repetition decay** on node ratings so stale-but-once-strong topics resurface.
- [ ] **Export:** one-click bundle of all notes to PDF/HTML for offline revision near exam day.
- [ ] **Token cost meter:** show per-generation Foundry token spend so the budget stays visible.
- [ ] **Conflict-safe writes:** small commit queue in the SPA to serialize commits and avoid ref races.
- [ ] **Search:** client-side full-text over cached notes (Lunr/Fuse) — no server needed.
- [ ] **PYQ import** pipeline (CSV or respectful scrape) to bulk-seed questions.
- [ ] **Cross-platform proxy later:** the same proxy compiled for macOS/Linux if you ever want to generate off Windows (deferred — you said Windows-only for now).

## Deferred (explicitly not in the 2-week sprint)

- [ ] Native Android client (revisit only after the web app earns its keep).
- [ ] Vector/semantic search (direct node lookups cover ~150-200 nodes; add embeddings later only for fuzzy cross-topic retrieval).
- [ ] Multi-user / sharing.

---

## Immediate next 3 actions
1. **Provision Azure AI Foundry**: deploy one Claude + one GPT model (serverless), grab endpoint + key, set a budget cap. Confirm a call works from a plain script (not the browser) first.
2. **Create the two repos** (`gate-prep` public + `gate-prep-data` private) and get a "hello world" SPA live on **GitHub Pages**, openable on your phone.
3. **Build the local proxy exe** and confirm the browser → `localhost` exe → Foundry → browser round-trip works with a pasted key (including the one-time Local Network Access allow) — this de-risks the single hardest part before any real UI.
