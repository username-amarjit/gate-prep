/* generate.js — note & question generation via the LOCAL proxy exe.
 *
 * The proxy is a generic pass-through: we POST {url, method, headers, body} to
 * `${proxyUrl}/proxy`, it forwards to Azure AI Foundry with the key we supply
 * per-request, and returns {status, body}. The key never leaves your machine's
 * memory + the local exe.
 *
 * Claude on Foundry (matches the AnthropicFoundry SDK):
 *   POST  {foundryBaseUrl}/v1/messages
 *   headers: x-api-key, anthropic-version: 2023-06-01, content-type: application/json
 *   body:    { model: <deployment>, max_tokens, system, messages:[{role,content}] }
 *   resp:    { content: [{type:"text", text}], usage, ... }
 *
 * GPT (optional, Azure OpenAI): a full chat/completions URL + api-key header.
 *
 * If nothing is configured/unlocked, we fall back to a clearly-labelled DEMO
 * note/question so the UI still works.
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const S = () => GP.store.state.settings;
  const azureKey = () => (GP.store.state.secrets || {}).azureKey;

  // The key can come from the browser (unlocked blob/session) OR the local proxy
  // can hold it (settings.proxyHoldsKey) — in which case it never enters the app.
  function keyAvailable() { return !!azureKey() || !!S().proxyHoldsKey; }
  function claudeReady() { return !!(S().proxyUrl && S().foundryBaseUrl && S().claudeModel && keyAvailable()); }
  function gptReady() { return !!(S().proxyUrl && S().gptEndpoint && keyAvailable()); }
  function proxyConfigured() { return claudeReady() || gptReady(); }

  // Choose provider by preference, falling back to whichever is configured.
  function pickProvider(pref) {
    const c = claudeReady(), g = gptReady();
    if (pref === "gpt" && g) return "gpt";
    if (pref === "claude" && c) return "claude";
    if (c) return "claude";
    if (g) return "gpt";
    return null;
  }

  async function callProxy(url, headers, body, keyHeader) {
    let res;
    try {
      res = await fetch(S().proxyUrl.replace(/\/$/, "") + "/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method: "POST", headers, body, keyHeader: keyHeader || "" }),
      });
    } catch (e) {
      throw new Error("Can't reach the local proxy at " + S().proxyUrl + " — is gate-proxy.exe running? (" + e.message + ")");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("Proxy " + res.status + ": " + t.slice(0, 200));
    }
    const wrapped = await res.json();
    if (wrapped.status && wrapped.status >= 400) {
      throw new Error("Azure " + wrapped.status + ": " + JSON.stringify(wrapped.body).slice(0, 300));
    }
    return wrapped.body;
  }

  async function complete(provider, systemPrompt, userPrompt, maxTokens) {
    const key = azureKey();
    const proxyKey = !key && S().proxyHoldsKey; // let the local proxy inject its key
    if (!key && !proxyKey) throw new Error("No Azure key — unlock a key, or enable 'local proxy supplies the Azure key' in Settings.");

    if (provider === "claude") {
      const base = (S().foundryBaseUrl || "").replace(/\/+$/, "");
      if (!base) throw new Error("Set the Foundry base URL in Settings.");
      const url = base + "/v1/messages";
      const headers = { "content-type": "application/json", "anthropic-version": "2023-06-01" };
      if (key) headers["x-api-key"] = key;
      const body = {
        model: S().claudeModel || "claude-opus-5",
        max_tokens: maxTokens || 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      };
      const resp = await callProxy(url, headers, body, proxyKey ? "x-api-key" : "");
      const text = (resp.content || []).filter((b) => b && b.type === "text").map((b) => b.text).join("").trim();
      if (!text) throw new Error("Empty completion from Claude (" + JSON.stringify(resp).slice(0, 200) + ")");
      return text;
    }

    // GPT — Azure OpenAI chat/completions (full URL incl. ?api-version=…)
    const url = S().gptEndpoint;
    if (!url) throw new Error("Set the GPT endpoint in Settings.");
    const headers = { "content-type": "application/json" };
    if (key) headers["api-key"] = key;
    const body = {
      max_tokens: maxTokens || 2000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    };
    const resp = await callProxy(url, headers, body, proxyKey ? "api-key" : "");
    const text = ((resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || "").trim();
    if (!text) throw new Error("Empty completion from GPT.");
    return text;
  }

  const NOTE_SYSTEM = [
    "You are an expert GATE CS/IT tutor. Write exam-focused, technically precise revision notes for ONE syllabus topic.",
    "",
    "SCOPE (STRICT): Include ONLY material within the official GATE CS/IT syllabus for THIS topic. Exclude university-level tangents, history, derivations GATE never asks, and advanced content outside the syllabus. If a commonly-taught point is out of GATE scope, omit it (at most a one-line 'beyond GATE scope' aside). Every statement must be standard, textbook-correct, and GATE-relevant — when unsure whether something is in scope, leave it out.",
    "",
    "OUTPUT: GitHub-Flavored Markdown only. Do NOT include a top-level H1 title (the app shows it). Use ## and ### headings.",
    "MATH: KaTeX — $...$ inline, $$...$$ for display. TABLES: Markdown tables. DIAGRAMS: ```mermaid fenced blocks",
    "(stateDiagram-v2 for automata, erDiagram for ER, flowchart/graph for processes, trees/graphs) placed EXACTLY where they aid understanding.",
    "Be correct and use standard GATE notation. High signal, no filler — accuracy over length.",
    "",
    "Use EXACTLY these sections, in this order (skip one only if genuinely not applicable):",
    "## Overview  — rigorous, first-principles explanation at GATE depth.",
    "## Key results & formulas  — the theorems/results/formulas that matter, with their conditions. Put any relevant table or diagram right here (or wherever it belongs in the flow).",
    "## Caveats & common pitfalls  — subtle points, edge cases, and the specific mistakes students make.",
    "## GATE focus  — what GATE has historically tested here, the question styles (conceptual vs numerical), recurring tricks, and exactly what to pay attention to.",
    "## Worked examples  — 1–2 examples worked step by step to build intuition.",
    "## Related topics  — bullets linking related nodes as [[node_id]]; one line each on the relationship AND how that connection can be asked in GATE. Use ONLY node ids from the provided 'Related node ids' list; never invent ids.",
  ].join("\n");

  // Candidate ids the model may [[link]] — everything in the same subject.
  function relatedCandidates(nodeId) {
    const subj = GP.store.subjectOf(nodeId);
    if (!subj) return "";
    return [subj].concat(GP.store.descendants(subj.id))
      .filter((n) => n.id !== nodeId)
      .slice(0, 60).map((n) => "- " + n.id + " — " + n.title).join("\n");
  }
  // Ground the "GATE focus" section in any PYQs we already hold for this node.
  function pyqContext(nodeId) {
    const qs = GP.store.questionsFor(nodeId).slice(0, 5);
    if (!qs.length) return "";
    return "\n\nPast/related questions on this node (inform 'GATE focus'; do not copy verbatim):\n" +
      qs.map((q, i) => (i + 1) + ". [" + (q.source || "") + "] " + (q.stem_md || "").replace(/\s+/g, " ").slice(0, 240)).join("\n");
  }

  function notePrompt(nodeId, hint) {
    const n = GP.store.node(nodeId) || { title: nodeId };
    const path = GP.store.ancestors(nodeId).map((a) => a.title).concat(n.title).join(" › ");
    const cands = relatedCandidates(nodeId);
    let p = "Topic: " + path + "\nNode id: " + nodeId + "  (level: " + (n.level || "learning_point") + ").";
    if (cands) p += "\n\nRelated node ids you may link with [[id]] (use only these):\n" + cands;
    p += pyqContext(nodeId);
    if (hint) p += "\n\nEmphasis / clarifying instruction: " + hint;
    return p;
  }

  async function note(nodeId, hint) {
    const provider = pickProvider(S().noteModel);
    if (!provider) return { body: demoNote(nodeId, hint), model: "demo" };
    const body = await complete(provider, NOTE_SYSTEM, notePrompt(nodeId, hint), 3500);
    return { body: body.trim(), model: provider + "-foundry" };
  }

  const Q_SYSTEM = [
    "You are an IIT professor who sets the GATE CS/IT examination. Produce ONE original, exam-quality question at genuine GATE difficulty for the given topic — testing understanding and application, not mere recall.",
    "SCOPE (STRICT): The question AND its solution must rely ONLY on the GATE CS/IT syllabus for this topic — no out-of-syllabus facts, no dependence on non-GATE knowledge or obscure trivia. It must be solvable by a well-prepared GATE candidate using standard syllabus concepts, and must match the style GATE actually uses. If you cannot make an in-scope question, make it simpler rather than going outside the syllabus.",
    "Return ONLY a strict JSON object (no prose, no markdown, no code fence) with keys:",
    '  "type"        : "MCQ" (exactly one correct) | "MSQ" (one or more correct) | "NAT" (numerical answer)',
    '  "stem_md"     : the question in Markdown; use $...$ for math, and Markdown tables or ```mermaid``` if the question needs a figure',
    '  "options"     : array of {"id":"A","md":"..."} for MCQ/MSQ; OMIT entirely for NAT',
    '  "answer"      : array of correct option ids for MCQ/MSQ, or {"value": <number>, "tol": <number>} for NAT',
    '  "solution_md" : a concise, correct explanation of WHY the answer holds and why the main distractors fail',
    '  "difficulty_elo" : integer 1000–1600 estimating difficulty',
    "Rules: exactly one unambiguous correct answer set; distractors must be plausible and encode common misconceptions; stay within GATE syllabus scope for this topic; prefer analysis/computation over definition recall; randomise which option letter is correct.",
  ].join("\n");

  async function question(nodeId, hint, opts) {
    opts = opts || {};
    const n = GP.store.node(nodeId) || { title: nodeId };
    const provider = pickProvider(S().questionModel);
    if (!provider) return demoQuestion(nodeId);
    // Explicit targetElo (e.g. a calibration ladder) overrides the learner's rating.
    const target = opts.targetElo || GP.store.ratingOf(nodeId); // 1200 if no prior record, else current Elo
    const path = GP.store.ancestors(nodeId).map((a) => a.title).concat(n.title).join(" › ");
    const notesCtx = GP.store.getNote(nodeId) ? "\n\nReference notes (for grounding; do not quote):\n" + GP.store.getNote(nodeId).body.slice(0, 1800) : "";
    const raw = await complete(provider, Q_SYSTEM,
      "Set a GATE question on:\n" + path + "\nNode id: " + nodeId + "." +
      "\nTarget difficulty: learner Elo ≈ " + target + ". Calibrate so a student at ~" + target + " has roughly a 50% chance of solving it, and set difficulty_elo near " + target + "." +
      (hint ? "\nEmphasis: " + hint : "") + notesCtx, 1600);
    let obj;
    try { obj = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()); }
    catch (e) { throw new Error("Model did not return valid JSON."); }
    return Object.assign({
      id: nodeId.replace(/\./g, "-") + "-" + Date.now().toString(36),
      node_id: nodeId, source: "generated", difficulty_elo: target,
      model: provider + "-foundry", verified: false,
    }, obj);
  }

  // Sequential batch generation with progress + cancel; saves locally (no per-item
  // commit) so the caller can push everything in one commit at the end.
  // Sleep `ms`, ticking onWait(secondsLeft) each second; returns early on cancel.
  function sleepWithCountdown(ms, onWait, shouldCancel) {
    return new Promise((resolve) => {
      const end = Date.now() + ms;
      (function tick() {
        const left = end - Date.now();
        if (left <= 0 || (shouldCancel && shouldCancel())) { onWait && onWait(0); return resolve(); }
        onWait && onWait(Math.ceil(left / 1000));
        setTimeout(tick, Math.min(1000, left));
      })();
    });
  }

  async function batchGenerate(kind, ids, opts) {
    opts = opts || {};
    // For questions, opts.targets = an Elo ladder ⇒ that many questions per topic.
    const targets = (kind === "questions" && opts.targets && opts.targets.length) ? opts.targets : null;
    const perItem = targets ? targets.length : 1;
    const res = { total: ids.length * perItem, done: 0, ok: 0, failed: 0, errors: [], cancelled: false };
    // Fresh random pacing per gap: 15–20 s between model calls (override via opts.delayMs).
    const paced = () => (opts.delayMs != null ? opts.delayMs : 15000 + Math.floor(Math.random() * 5001));
    for (const id of ids) {
      for (let k = 0; k < perItem; k++) {
        if (opts.shouldCancel && opts.shouldCancel()) { res.cancelled = true; break; }
        opts.onProgress && opts.onProgress(res, id);
        try {
          if (kind === "notes") {
            const g = await note(id);
            await GP.store.saveNote(id, { body: g.body, model: g.model, status: "draft", rating: GP.store.ratingOf(id) }, { commit: false });
          } else {
            const q = await question(id, null, { targetElo: targets ? targets[k] : undefined });
            await GP.store.addQuestion(q, { commit: false });
          }
          res.ok++;
        } catch (e) { res.failed++; res.errors.push({ id: id, error: e.message }); }
        res.done++;
        opts.onProgress && opts.onProgress(res, null);
        // Pace before the NEXT call (skip after the final one / on cancel).
        if (res.done < res.total && !(opts.shouldCancel && opts.shouldCancel())) {
          await sleepWithCountdown(paced(), opts.onWait, opts.shouldCancel);
        }
      }
      if (res.cancelled) break;
    }
    return res;
  }

  // Connectivity/generation smoke test used by Settings → "Test generation".
  async function test() {
    const provider = pickProvider(S().noteModel);
    if (!provider) throw new Error("Set the proxy URL, Foundry base URL + deployment, and a key (or enable proxy-holds-key) first.");
    const text = await complete(provider, "You are a connectivity test.", "Reply with exactly the single word: PONG", 16);
    return { provider, text: text.trim() };
  }

  // ---- demo fallbacks (no Azure needed) -----------------------------------
  function demoNote(nodeId, hint) {
    const n = GP.store.node(nodeId) || { title: nodeId };
    return [
      "> _Demo note_ — set the Foundry base URL + Claude deployment in **Settings** and unlock your Azure key to generate real content.",
      "",
      "## " + n.title,
      "",
      "This is a placeholder for **" + n.title + "** (`" + nodeId + "`)" + (hint ? " — emphasis: _" + hint + "_" : "") + ".",
      "",
      "- Key definition goes here.",
      "- A worked example with math like $\\sum_{i=1}^{n} i = \\tfrac{n(n+1)}{2}$.",
      "- Common GATE pitfalls.",
      "",
      "```mermaid",
      "flowchart LR",
      "  A[Concept] --> B[Example]",
      "  B --> C[GATE question]",
      "```",
    ].join("\n");
  }
  function demoQuestion(nodeId) {
    const n = GP.store.node(nodeId) || { title: nodeId };
    return {
      id: nodeId.replace(/\./g, "-") + "-demo-" + Date.now().toString(36),
      node_id: nodeId, type: "MCQ", source: "generated", difficulty_elo: 1200, model: "demo", verified: false,
      stem_md: "_(Demo)_ Which statement about **" + n.title + "** is correct?",
      options: [{ id: "A", md: "A plausible-looking option." }, { id: "B", md: "The correct option." },
        { id: "C", md: "A distractor." }, { id: "D", md: "Another distractor." }],
      answer: ["B"], solution_md: "This is a demo question. Wire up Azure Foundry to generate real ones.",
    };
  }

  GP.generate = { note, question, test, batchGenerate, proxyConfigured, claudeReady, gptReady };
})();
