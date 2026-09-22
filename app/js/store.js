/* store.js — the data model + persistence.
 *
 * Source-of-truth model (from the checklist):
 *   - The PRIVATE GitHub data repo holds the canonical files (when configured).
 *   - IndexedDB is a rebuildable cache.
 *   - SEED (seed.js) is the zero-setup fallback so the app is always viewable.
 *
 * Settings (repo, proxy URL, endpoints, model names, theme) are non-secret and
 * live in localStorage. Secrets (PAT, Azure key) live only in memory +
 * sessionStorage after passphrase unlock, and are cleared on lock.
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const { toast } = GP.lib;

  // ---- minimal IndexedDB key/value cache -----------------------------------
  const DB_NAME = "gate-prep", STORE = "kv";
  let _db = null;
  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(k) {
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const t = db.transaction(STORE, "readonly").objectStore(STORE).get(k);
        t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error);
      });
    } catch (e) { return undefined; }
  }
  async function idbSet(k, v) {
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const t = db.transaction(STORE, "readwrite").objectStore(STORE).put(v, k);
        t.onsuccess = () => res(true); t.onerror = () => rej(t.error);
      });
    } catch (e) { return false; }
  }
  async function idbClear() {
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const t = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
        t.onsuccess = () => res(true); t.onerror = () => rej(t.error);
      });
    } catch (e) { return false; }
  }

  // ---- settings (non-secret) ----------------------------------------------
  const SETTINGS_KEY = "gp.settings";
  const defaultSettings = {
    dataOwner: "", dataRepo: "", dataBranch: "main",
    patBlobUrl: "", // public URL of pat.enc.json (for unlock-anywhere)
    proxyUrl: "http://localhost:8765",
    // Azure AI Foundry — Claude via the AnthropicFoundry base_url + deployment.
    foundryBaseUrl: "", claudeModel: "claude-opus-5",
    // Optional GPT via an Azure OpenAI chat/completions URL.
    gptEndpoint: "",
    // When true, the browser omits the Azure key and the local proxy injects
    // its own (from AZURE_API_KEY / -azure-key) — key never enters the app/blob.
    proxyHoldsKey: false,
    // Opus/Sonnet 5 can default extended thinking ON, which empties/pollutes
    // output. Disable it by default for clean, reliable generation.
    disableThinking: true,
    noteModel: "claude", questionModel: "claude",
    theme: "dark",
  };
  function loadSettings() {
    try { return Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
    catch (e) { return Object.assign({}, defaultSettings); }
  }
  function saveSettings(s) {
    state.settings = Object.assign({}, state.settings, s);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }

  // ---- secrets (memory + sessionStorage only) ------------------------------
  const SECRETS_KEY = "gp.secrets"; // sessionStorage
  function loadSecrets() {
    try { return JSON.parse(sessionStorage.getItem(SECRETS_KEY) || "null"); } catch (e) { return null; }
  }
  function setSecrets(sec) {
    state.secrets = sec || null;
    if (sec) sessionStorage.setItem(SECRETS_KEY, JSON.stringify(sec));
    else sessionStorage.removeItem(SECRETS_KEY);
  }
  function lock() { setSecrets(null); }
  function isUnlocked() { return !!(state.secrets && state.secrets.pat); }
  function githubReady() {
    return !!(state.settings.dataOwner && state.settings.dataRepo && isUnlocked());
  }

  // ---- tree flattening -----------------------------------------------------
  const LEVELS = ["main_topic", "subtopic", "learning_point"];
  function flatten(sections) {
    const nodes = [];
    (function walk(list, parentFull, depth) {
      (list || []).forEach((n, i) => {
        const full = parentFull ? parentFull + "." + n.id : n.id;
        nodes.push({
          id: full, shortId: n.id, title: n.title,
          level: LEVELS[depth] || "learning_point",
          parentId: parentFull || null, order: i,
        });
        if (n.children) walk(n.children, full, depth + 1);
      });
    })(sections, null, 0);
    return nodes;
  }
  function rebuildIndexes() {
    state.byId = {};
    state.nodes.forEach((n) => (state.byId[n.id] = n));
    state.children = {};
    state.nodes.forEach((n) => {
      const p = n.parentId || "__root__";
      (state.children[p] = state.children[p] || []).push(n);
    });
    for (const p in state.children) state.children[p].sort((a, b) => a.order - b.order);
  }

  // ---- state ---------------------------------------------------------------
  const state = {
    settings: loadSettings(),
    secrets: loadSecrets(),
    syllabus: null,   // nested
    nodes: [],        // flat
    byId: {}, children: {},
    notes: {},        // id -> note
    questions: [],    // array
    studyPath: [],    // array of ids
    attempts: {},     // id -> count (for elo K)
    source: "local",  // 'github' | 'local'
  };

  // ---- load / init ---------------------------------------------------------
  async function init() {
    const [syl, notes, questions, studyPath, attempts] = await Promise.all([
      idbGet("syllabus"), idbGet("notes"), idbGet("questions"), idbGet("studyPath"), idbGet("attempts"),
    ]);
    state.syllabus = syl || (window.SEED && window.SEED.syllabus) || [];
    state.notes = notes || (window.SEED && window.SEED.notes) || {};
    state.questions = questions || (window.SEED && window.SEED.questions) || [];
    state.studyPath = studyPath || (window.SEED && window.SEED.study_path) || [];
    state.attempts = attempts || {};
    state.nodes = flatten(state.syllabus);
    rebuildIndexes();
    // If GitHub is configured & unlocked, refresh from repo in the background.
    if (githubReady()) { pullFromRepo().catch((e) => console.warn("pull failed", e)); }
    return state;
  }

  // ---- node accessors ------------------------------------------------------
  const node = (id) => state.byId[id];
  const childrenOf = (id) => state.children[id || "__root__"] || [];
  const roots = () => childrenOf(null);
  function ancestors(id) {
    const out = []; let n = node(id);
    while (n && n.parentId) { n = node(n.parentId); if (n) out.unshift(n); }
    return out;
  }
  function subjectOf(id) { const a = ancestors(id); return a.length ? a[0] : node(id); }
  function descendants(id) {
    const out = []; (function rec(pid) { childrenOf(pid).forEach((c) => { out.push(c); rec(c.id); }); })(id);
    return out;
  }
  function coverage(id) {
    const ids = new Set([id, ...descendants(id).map((n) => n.id)]);
    let notes = 0, qs = 0;
    for (const nid of ids) if (state.notes[nid]) notes++;
    state.questions.forEach((q) => { if (ids.has(q.node_id)) qs++; });
    const rating = state.notes[id] ? state.notes[id].rating : null;
    return { notes, questions: qs, rating };
  }
  const titleOf = (id) => (node(id) ? node(id).title : id);

  // ---- notes ---------------------------------------------------------------
  function getNote(id) { return state.notes[id] || null; }
  async function saveNote(id, patch, opts) {
    opts = opts || {};
    const prev = state.notes[id] || {};
    const n = Object.assign({}, prev, patch, {
      title: patch.title || prev.title || titleOf(id),
      updated: new Date().toISOString().slice(0, 10),
    });
    state.notes[id] = n;
    await idbSet("notes", state.notes);
    if (opts.commit !== false && githubReady()) {
      try { await GP.github.commitNote(id, n); toast("Committed note to GitHub", "ok"); }
      catch (e) { toast("Saved locally; GitHub commit failed: " + e.message, "warn"); }
    }
    return n;
  }
  async function deleteNote(id) {
    delete state.notes[id];
    await idbSet("notes", state.notes);
    if (githubReady()) { try { await GP.github.deleteNote(id); } catch (e) { /* best-effort */ } }
  }

  // ---- questions -----------------------------------------------------------
  function questionsFor(id) {
    const ids = new Set([id, ...descendants(id).map((n) => n.id)]);
    return state.questions.filter((q) => ids.has(q.node_id));
  }
  async function addQuestion(q, opts) {
    opts = opts || {};
    state.questions.push(q);
    await idbSet("questions", state.questions);
    if (opts.commit !== false && githubReady()) { try { await GP.github.commitQuestion(q); } catch (e) { /* best-effort */ } }
  }

  // ---- ratings / attempts --------------------------------------------------
  function ratingOf(id) { return (state.notes[id] && state.notes[id].rating) || GP.elo.DEFAULT; }
  async function recordAttempt(id, newRating) {
    state.attempts[id] = (state.attempts[id] || 0) + 1;
    if (state.notes[id]) state.notes[id].rating = newRating;
    else state.notes[id] = { title: titleOf(id), rating: newRating, status: "draft", body: "" };
    await Promise.all([idbSet("attempts", state.attempts), idbSet("notes", state.notes)]);
  }

  // ---- study path ----------------------------------------------------------
  function getStudyPath() {
    if (state.studyPath && state.studyPath.length) return state.studyPath.filter((id) => state.byId[id]);
    // fallback: DFS order of leaf-ish nodes that have notes, else all leaves
    return state.nodes.filter((n) => state.notes[n.id]).map((n) => n.id);
  }
  async function setStudyPath(ids) {
    state.studyPath = ids.slice();
    await idbSet("studyPath", state.studyPath);
    if (githubReady()) { try { await GP.github.commitStudyPath(state.studyPath); } catch (e) { /* best-effort */ } }
  }

  // ---- tree CRUD -----------------------------------------------------------
  // locate a nested node by its full dotted id -> { node, arr, index, full }
  function locate(id) {
    let res = null;
    (function walk(list, parentFull) {
      for (let i = 0; i < list.length; i++) {
        const full = parentFull ? parentFull + "." + list[i].id : list[i].id;
        if (full === id) { res = { node: list[i], arr: list, index: i, full }; return; }
        if (list[i].children) walk(list[i].children, full);
        if (res) return;
      }
    })(state.syllabus, null);
    return res;
  }
  async function persistTree() {
    await idbSet("syllabus", state.syllabus);
    state.nodes = flatten(state.syllabus); rebuildIndexes();
    if (githubReady()) { try { await GP.github.commitTree(state.syllabus); } catch (e) { toast("Tree saved locally; GitHub commit failed", "warn"); } }
  }
  async function addNode(parentId, title) {
    const child = { id: GP.lib.slug(title) };
    child.title = title;
    const list = parentId ? (locate(parentId).node.children || (locate(parentId).node.children = [])) : state.syllabus;
    // avoid duplicate shortId among siblings
    let base = child.id, k = 2;
    while (list.some((s) => s.id === child.id)) child.id = base + "-" + k++;
    list.push({ id: child.id, title });
    await persistTree();
    return (parentId ? parentId + "." : "") + child.id;
  }
  async function renameNode(id, title) {
    const loc = locate(id); if (!loc) return;
    loc.node.title = title; await persistTree();
  }
  async function deleteNode(id) {
    const loc = locate(id); if (!loc) return;
    loc.arr.splice(loc.index, 1);
    await persistTree();
  }

  // ---- GitHub pull / rebuild ----------------------------------------------
  async function pullFromRepo() {
    if (!githubReady()) throw new Error("GitHub not configured/unlocked");
    const data = await GP.github.pullAll();
    if (data.syllabus) { state.syllabus = data.syllabus; await idbSet("syllabus", state.syllabus); }
    if (data.notes) { state.notes = data.notes; await idbSet("notes", state.notes); }
    if (data.questions) { state.questions = data.questions; await idbSet("questions", state.questions); }
    if (data.studyPath) { state.studyPath = data.studyPath; await idbSet("studyPath", state.studyPath); }
    state.nodes = flatten(state.syllabus); rebuildIndexes();
    state.source = "github";
    return true;
  }
  async function pushAllToRepo() {
    if (!githubReady()) throw new Error("Set the data repo owner/name in Settings and unlock first.");
    return GP.github.pushAll();
  }
  async function rebuildCacheFromRepo() {
    await idbClear();
    if (githubReady()) return pullFromRepo();
    // no repo: reset to seed
    state.syllabus = (window.SEED && window.SEED.syllabus) || [];
    state.notes = (window.SEED && window.SEED.notes) || {};
    state.questions = (window.SEED && window.SEED.questions) || [];
    state.studyPath = (window.SEED && window.SEED.study_path) || [];
    state.nodes = flatten(state.syllabus); rebuildIndexes();
    return true;
  }

  // ---- search --------------------------------------------------------------
  function search(q) {
    q = (q || "").toLowerCase().trim(); if (!q) return [];
    const out = [];
    state.nodes.forEach((n) => {
      const body = state.notes[n.id] ? state.notes[n.id].body || "" : "";
      const hay = (n.title + " " + n.id + " " + body).toLowerCase();
      if (hay.includes(q)) out.push({ id: n.id, title: n.title, hasNote: !!state.notes[n.id], level: n.level });
    });
    return out.slice(0, 40);
  }

  // ---- manifest (index.json) ----------------------------------------------
  function buildIndex() {
    return {
      generatedAt: new Date().toISOString(),
      nodes: state.nodes.map((n) => ({ id: n.id, title: n.title, level: n.level, parentId: n.parentId, order: n.order })),
      notes: Object.keys(state.notes).map((id) => ({ id, status: state.notes[id].status || "draft", rating: state.notes[id].rating || null })),
      questions: state.questions.map((q) => ({ id: q.id, node_id: q.node_id, type: q.type, source: q.source })),
      studyPath: state.studyPath,
    };
  }

  GP.store = {
    state, init, idbClear,
    loadSettings, saveSettings, defaultSettings,
    setSecrets, lock, isUnlocked, githubReady,
    node, childrenOf, roots, ancestors, subjectOf, descendants, coverage, titleOf,
    getNote, saveNote, deleteNote,
    questionsFor, addQuestion,
    ratingOf, recordAttempt,
    getStudyPath, setStudyPath,
    locate, addNode, renameNode, deleteNode,
    pullFromRepo, pushAllToRepo, rebuildCacheFromRepo, buildIndex, search,
  };
})();
