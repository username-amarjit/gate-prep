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

  function claudeReady() { return !!(S().proxyUrl && S().foundryBaseUrl && S().claudeModel && azureKey()); }
  function gptReady() { return !!(S().proxyUrl && S().gptEndpoint && azureKey()); }
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

  async function callProxy(url, headers, body) {
    let res;
    try {
      res = await fetch(S().proxyUrl.replace(/\/$/, "") + "/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method: "POST", headers, body }),
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
    if (!key) throw new Error("Locked — unlock to load your Azure key.");

    if (provider === "claude") {
      const base = (S().foundryBaseUrl || "").replace(/\/+$/, "");
      if (!base) throw new Error("Set the Foundry base URL in Settings.");
      const url = base + "/v1/messages";
      const headers = { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
      const body = {
        model: S().claudeModel || "claude-opus-5",
        max_tokens: maxTokens || 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      };
      const resp = await callProxy(url, headers, body);
      const text = (resp.content || []).filter((b) => b && b.type === "text").map((b) => b.text).join("").trim();
      if (!text) throw new Error("Empty completion from Claude (" + JSON.stringify(resp).slice(0, 200) + ")");
      return text;
    }

    // GPT — Azure OpenAI chat/completions (full URL incl. ?api-version=…)
    const url = S().gptEndpoint;
    if (!url) throw new Error("Set the GPT endpoint in Settings.");
    const headers = { "content-type": "application/json", "api-key": key };
    const body = {
      max_tokens: maxTokens || 2000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    };
    const resp = await callProxy(url, headers, body);
    const text = ((resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || "").trim();
    if (!text) throw new Error("Empty completion from GPT.");
    return text;
  }

  const NOTE_SYSTEM =
    "You write concise, exam-accurate revision notes for the Indian GATE CS/IT examination. " +
    "Use GitHub-flavoured Markdown. Use $...$ / $$...$$ for math (KaTeX), Markdown tables for tabular data, " +
    "and ```mermaid fenced blocks for diagrams (state machines, ER, flowcharts, trees). Be rigorous and " +
    "GATE-depth: definitions, key results, one worked example, and common pitfalls. Do NOT include a title heading.";

  function notePrompt(nodeId, hint) {
    const n = GP.store.node(nodeId) || { title: nodeId };
    const path = GP.store.ancestors(nodeId).map((a) => a.title).concat(n.title).join(" › ");
    let p = "Write GATE-depth revision notes for the topic:\n\n" + path + "\n\nNode id: " + nodeId + ".";
    if (hint) p += "\n\nEmphasis / clarifying instruction: " + hint;
    return p;
  }

  async function note(nodeId, hint) {
    const provider = pickProvider(S().noteModel);
    if (!provider) return { body: demoNote(nodeId, hint), model: "demo" };
    const body = await complete(provider, NOTE_SYSTEM, notePrompt(nodeId, hint), 2200);
    return { body: body.trim(), model: provider + "-foundry" };
  }

  const Q_SYSTEM =
    "You are a GATE CS/IT question setter. Produce ONE question as strict JSON with keys: " +
    "type ('MCQ'|'MSQ'|'NAT'), stem_md, options (array of {id,md} for MCQ/MSQ; omit for NAT), " +
    "answer (array of option ids, or {value,tol} for NAT), solution_md. Use $...$ for math. " +
    "Return ONLY the JSON object, no prose, no code fence.";

  async function question(nodeId, hint) {
    const n = GP.store.node(nodeId) || { title: nodeId };
    const provider = pickProvider(S().questionModel);
    if (!provider) return demoQuestion(nodeId);
    const notesCtx = GP.store.getNote(nodeId) ? "\n\nReference notes:\n" + GP.store.getNote(nodeId).body.slice(0, 1500) : "";
    const raw = await complete(provider, Q_SYSTEM,
      "Create a GATE-style question for: " + n.title + " (" + nodeId + ")." + (hint ? " " + hint : "") + notesCtx, 1200);
    let obj;
    try { obj = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()); }
    catch (e) { throw new Error("Model did not return valid JSON."); }
    return Object.assign({
      id: nodeId.replace(/\./g, "-") + "-" + Date.now().toString(36),
      node_id: nodeId, source: "generated", difficulty_elo: 1200,
      model: provider + "-foundry", verified: false,
    }, obj);
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

  GP.generate = { note, question, proxyConfigured, claudeReady, gptReady };
})();
