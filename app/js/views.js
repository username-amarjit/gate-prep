/* views.js — all screens. Each renderer returns a DOM node mounted into #view.
 * Uses GP.store for data, GP.md for markdown, GP.generate for AI, GP.elo for quiz.
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const { el, esc, toast } = GP.lib;
  const store = GP.store;

  function levelBadge(level) {
    const map = { main_topic: "Subject", subtopic: "Topic", learning_point: "Point" };
    return el("span", { class: "badge lvl-" + level, text: map[level] || level });
  }
  function coverageBadges(id) {
    const c = store.coverage(id);
    const wrap = el("span", { class: "cov" });
    wrap.appendChild(el("span", { class: "chip" + (c.notes ? " has" : ""), title: "notes", text: "📝 " + c.notes }));
    wrap.appendChild(el("span", { class: "chip" + (c.questions ? " has" : ""), title: "questions", text: "❓ " + c.questions }));
    if (c.rating) wrap.appendChild(el("span", { class: "chip rating", title: "your rating", text: "★ " + c.rating }));
    return wrap;
  }
  function crumbs(id) {
    const wrap = el("nav", { class: "crumbs" });
    wrap.appendChild(el("a", { href: "#/", text: "All subjects" }));
    store.ancestors(id).forEach((a) => {
      wrap.appendChild(el("span", { class: "sep", text: "›" }));
      wrap.appendChild(el("a", { href: "#/note/" + encodeURIComponent(a.id), text: a.title }));
    });
    const self = store.node(id);
    if (self) { wrap.appendChild(el("span", { class: "sep", text: "›" })); wrap.appendChild(el("span", { class: "here", text: self.title })); }
    return wrap;
  }

  // Recursive collapsible tree
  function treeList(rootId, opts) {
    opts = opts || {};
    const ul = el("ul", { class: "tree" });
    store.childrenOf(rootId).forEach((n) => ul.appendChild(treeItem(n, opts)));
    return ul;
  }
  function treeItem(n, opts) {
    const kids = store.childrenOf(n.id);
    const li = el("li", { class: "tnode" });
    const row = el("div", { class: "trow lvl-" + n.level });
    if (kids.length) {
      const tog = el("button", { class: "toggle", text: "▸", title: "expand" });
      row.appendChild(tog);
      tog.addEventListener("click", () => {
        li.classList.toggle("open");
        tog.textContent = li.classList.contains("open") ? "▾" : "▸";
      });
    } else {
      row.appendChild(el("span", { class: "toggle leaf", text: "•" }));
    }
    const hasNote = !!store.getNote(n.id);
    const label = el("a", {
      class: "tlabel", href: "#/note/" + encodeURIComponent(n.id), text: n.title,
    });
    row.appendChild(label);
    row.appendChild(coverageBadges(n.id));
    if (!hasNote) {
      const gen = el("button", { class: "mini", title: "generate note", text: "✨" });
      gen.addEventListener("click", (e) => { e.preventDefault(); quickGenerate(n.id); });
      row.appendChild(gen);
    }
    li.appendChild(row);
    if (kids.length) {
      const sub = el("div", { class: "children" });
      kids.forEach((c) => sub.appendChild(treeItem(c, opts)));
      li.appendChild(sub);
      if (opts.openDepth && depthOf(n.id) < opts.openDepth) { li.classList.add("open"); row.querySelector(".toggle").textContent = "▾"; }
    }
    return li;
  }
  function depthOf(id) { return store.ancestors(id).length; }

  // ---- Home / all subjects -------------------------------------------------
  function home() {
    const v = el("div", { class: "page" });
    // stats
    const totalNotes = Object.keys(store.state.notes).length;
    const totalNodes = store.state.nodes.length;
    const totalQ = store.state.questions.length;
    v.appendChild(el("div", { class: "hero" }, [
      el("h1", { text: "GATE CS/IT — AI Prep" }),
      el("p", { class: "muted", text: "Notes, diagrams and adaptive quizzing across the full GATE 2027 CS syllabus." }),
      el("div", { class: "stats" }, [
        stat(totalNodes, "topics"), stat(totalNotes, "notes"), stat(totalQ, "questions"),
        stat(store.state.source === "github" ? "GitHub" : "local", "source"),
      ]),
    ]));
    // continue studying
    const sp = store.getStudyPath();
    const next = sp.find((id) => store.getNote(id)) || sp[0];
    if (next) {
      v.appendChild(el("div", { class: "card cta" }, [
        el("div", {}, [el("div", { class: "muted small", text: "Continue on your study path" }),
          el("div", { class: "cta-title", text: store.titleOf(next) })]),
        el("a", { class: "btn primary", href: "#/note/" + encodeURIComponent(next), text: "Open →" }),
        el("a", { class: "btn", href: "#/book", text: "Read in sequence" }),
      ]));
    }
    // subject cards
    const grid = el("div", { class: "grid" });
    store.roots().forEach((s) => {
      const c = store.coverage(s.id);
      const card = el("a", { class: "card subject", href: "#/subject/" + encodeURIComponent(s.id) }, [
        el("h3", { text: s.title }),
        el("div", { class: "muted small", text: store.descendants(s.id).filter((x) => x.level === "learning_point").length + " learning points" }),
        el("div", { class: "cov big" }, [
          el("span", { class: "chip" + (c.notes ? " has" : ""), text: "📝 " + c.notes }),
          el("span", { class: "chip" + (c.questions ? " has" : ""), text: "❓ " + c.questions }),
        ]),
      ]);
      grid.appendChild(card);
    });
    v.appendChild(el("h2", { text: "Subjects" }));
    v.appendChild(grid);
    // full collapsible tree
    v.appendChild(el("h2", { text: "Full syllabus tree" }));
    v.appendChild(treeList(null));
    return v;
  }
  function stat(n, label) { return el("div", { class: "stat" }, [el("div", { class: "num", text: String(n) }), el("div", { class: "lbl", text: label })]); }

  // ---- Subject page --------------------------------------------------------
  function subject(id) {
    const s = store.node(id);
    const v = el("div", { class: "page" });
    if (!s) { v.appendChild(el("p", { text: "Unknown subject." })); return v; }
    v.appendChild(crumbs(id));
    v.appendChild(el("div", { class: "row spread" }, [
      el("h1", { text: s.title }),
      el("a", { class: "btn", href: "#/book/" + encodeURIComponent(id), text: "📖 Read this subject" }),
    ]));
    v.appendChild(el("div", { class: "row gap", style: "margin-bottom:.6rem" }, [
      el("button", { class: "btn", text: "✨ Missing notes", onClick: () => batchForScope(id, "notes", "missing") }),
      el("button", { class: "btn", text: "✨ All notes", onClick: () => batchForScope(id, "notes", "all") }),
      el("button", { class: "btn", text: "❓ 10 Q/topic (missing)", onClick: () => batchForScope(id, "questions", "missing") }),
      el("button", { class: "btn", text: "❓ 10 Q/topic (all)", onClick: () => batchForScope(id, "questions", "all") }),
    ]));
    v.appendChild(treeList(id, { openDepth: 2 }));
    return v;
  }

  // ---- batch generation ----------------------------------------------------
  const QSET = 10; // questions per topic (calibration ladder size)
  // A low→(extremely) high Elo ladder so a first quiz places the student well.
  function calibrationElos(n) {
    const lo = 900, hi = 1900;
    if (n <= 1) return [1200];
    const step = (hi - lo) / (n - 1);
    return Array.from({ length: n }, (_, i) => Math.round(lo + i * step));
  }
  function leavesUnder(rootId) {
    const all = rootId ? store.descendants(rootId) : store.state.nodes;
    return all.filter((n) => store.childrenOf(n.id).length === 0);
  }
  // kind: "notes"|"questions"; mode: "missing"|"all"
  function batchForScope(rootId, kind, mode) {
    const leaves = leavesUnder(rootId);
    const label = rootId ? store.titleOf(rootId) : "whole syllabus";
    let ids, extra = {};
    if (kind === "notes") {
      ids = (mode === "all" ? leaves : leaves.filter((n) => !store.getNote(n.id))).map((n) => n.id);
    } else {
      ids = (mode === "all" ? leaves : leaves.filter((n) => store.questionsFor(n.id).length === 0)).map((n) => n.id);
      extra.targets = calibrationElos(QSET);
    }
    if (!ids.length) { toast("Nothing to do for " + label + " (already present).", "ok"); return; }
    if (!GP.generate.proxyConfigured()) { toast("Configure Azure in Settings first — batch would only make demo content.", "warn"); return; }
    const calls = kind === "questions" ? ids.length * QSET : ids.length;
    const what = kind === "questions" ? (ids.length + " topics × " + QSET + " = " + calls + " questions") : (ids.length + " notes");
    if (!confirm("Generate " + what + " for " + label + "?\n" + calls + " model calls — mind the time + Azure cost.")) return;
    runBatch(kind, ids, label, extra);
  }
  // A varied-difficulty set for ONE topic (the "first quiz" placement set).
  function genQuestionSet(nodeId, count) {
    if (!GP.generate.proxyConfigured()) { toast("Configure Azure in Settings first.", "warn"); return; }
    runBatch("questions", [nodeId], store.titleOf(nodeId) + " — calibration", { targets: calibrationElos(count || QSET) });
  }
  function runBatch(kind, ids, label, extra) {
    let cancelled = false, finished = false;
    const bar = el("div", { class: "muted", text: "Starting…" });
    const waitLine = el("div", { class: "small muted", style: "margin-top:.2rem" });
    const errbox = el("div", { class: "small warn-text", style: "margin-top:.4rem; max-height:8rem; overflow:auto" });
    const btn = el("button", { class: "btn", text: "Cancel", onClick: () => {
      if (finished) { overlay.remove(); route(); } else { cancelled = true; btn.textContent = "Cancelling…"; }
    } });
    const box = el("div", { class: "modal" }, [el("h2", { text: "Generating " + kind + " — " + label }), bar, waitLine, errbox, el("div", { class: "row gap", style: "margin-top:.6rem" }, [btn])]);
    const overlay = el("div", { class: "overlay" }, [box]);
    document.body.appendChild(overlay);
    GP.generate.batchGenerate(kind, ids, Object.assign({
      shouldCancel: () => cancelled,
      onProgress: (res, curId) => {
        bar.textContent = res.done + " / " + res.total + " done"
          + (curId ? " · now: " + store.titleOf(curId) : "")
          + (res.failed ? " · " + res.failed + " failed" : "");
      },
      onWait: (secs) => { waitLine.textContent = secs > 0 ? "⏳ pacing to respect rate limits — next call in " + secs + "s" : ""; },
    }, extra || {})).then(async (res) => {
      finished = true;
      waitLine.textContent = "";
      bar.textContent = "Generated " + res.ok + "/" + res.total + (res.cancelled ? " (cancelled)" : "") + ". ";
      if (res.errors.length) errbox.textContent = res.errors.slice(0, 8).map((e) => store.titleOf(e.id) + ": " + e.error).join("  |  ");
      if (store.githubReady() && res.ok) {
        bar.textContent += "Committing to repo…";
        try { const sha = await store.pushAllToRepo(); bar.textContent = "Done — " + res.ok + " generated, committed " + String(sha).slice(0, 7) + "."; }
        catch (e) { bar.textContent += " commit failed: " + e.message; }
      }
      btn.textContent = "Close";
    });
  }

  // ---- Note page -----------------------------------------------------------
  function notePage(id) {
    const n = store.node(id);
    const v = el("div", { class: "page note-page" });
    if (!n) { v.appendChild(el("p", { text: "Unknown topic." })); return v; }
    v.appendChild(crumbs(id));
    const note = store.getNote(id);
    const head = el("div", { class: "row spread wrap" }, [
      el("div", {}, [el("h1", { text: n.title }), levelBadge(n.level)]),
      el("div", { class: "row gap" }, [
        el("button", { class: "btn", text: note ? "✏️ Edit" : "✏️ Write", onClick: () => editNote(id) }),
        el("button", { class: "btn", text: "✨ " + (note ? "Regenerate" : "Generate"), onClick: () => regenerate(id) }),
        el("button", { class: "btn", text: "🎯 10-Q set", onClick: () => genQuestionSet(id, 10) }),
        el("a", { class: "btn", href: "#/quiz?node=" + encodeURIComponent(id), text: "❓ Quiz this" }),
      ]),
    ]);
    v.appendChild(head);

    if (note) {
      const meta = el("div", { class: "note-meta" }, [
        el("span", { class: "badge status-" + (note.status || "draft"), text: note.status || "draft" }),
        note.rating ? el("span", { class: "chip rating", text: "★ " + note.rating }) : null,
        note.model ? el("span", { class: "muted small", text: "via " + note.model }) : null,
        note.updated ? el("span", { class: "muted small", text: "updated " + note.updated }) : null,
      ]);
      v.appendChild(meta);
      // prereq / related chips
      const rel = el("div", { class: "rel" });
      (note.prereqs || []).forEach((pid) => rel.appendChild(el("a", { class: "chip prereq", href: "#/note/" + encodeURIComponent(pid), text: "⟵ " + store.titleOf(pid) })));
      (note.related || []).forEach((rid) => rel.appendChild(el("a", { class: "chip related", href: "#/note/" + encodeURIComponent(rid), text: "↔ " + store.titleOf(rid) })));
      if (rel.children.length) v.appendChild(rel);

      const body = el("article", { class: "md" });
      GP.md.renderInto(body, note.body || "_(empty note)_", { titleOf: store.titleOf });
      v.appendChild(body);
    } else {
      v.appendChild(el("div", { class: "empty" }, [
        el("p", { text: "No note yet for this topic." }),
        el("button", { class: "btn primary", text: "✨ Generate a note", onClick: () => regenerate(id) }),
      ]));
    }

    // prev / next along study path
    const sp = store.getStudyPath();
    const i = sp.indexOf(id);
    if (i !== -1) {
      const nav = el("div", { class: "prevnext" });
      if (sp[i - 1]) nav.appendChild(el("a", { class: "btn", href: "#/note/" + encodeURIComponent(sp[i - 1]), text: "← " + store.titleOf(sp[i - 1]) }));
      else nav.appendChild(el("span", {}));
      if (sp[i + 1]) nav.appendChild(el("a", { class: "btn", href: "#/note/" + encodeURIComponent(sp[i + 1]), text: store.titleOf(sp[i + 1]) + " →" }));
      v.appendChild(nav);
    }
    return v;
  }

  function editNote(id) {
    const n = store.node(id); const note = store.getNote(id) || { body: "", status: "draft" };
    const v = el("div", { class: "page" });
    v.appendChild(crumbs(id));
    v.appendChild(el("h1", { text: "Edit: " + n.title }));
    const ta = el("textarea", { class: "editor", rows: 22 }); ta.value = note.body || "";
    const status = el("select", { class: "inp" });
    ["draft", "verified"].forEach((s) => { const o = el("option", { value: s, text: s }); if ((note.status || "draft") === s) o.selected = true; status.appendChild(o); });
    const prereqs = el("input", { class: "inp", placeholder: "prereq ids, comma-separated" }); prereqs.value = (note.prereqs || []).join(", ");
    const related = el("input", { class: "inp", placeholder: "related ids, comma-separated" }); related.value = (note.related || []).join(", ");
    const preview = el("article", { class: "md preview" });
    const doPreview = GP.lib.debounce(() => GP.md.renderInto(preview, ta.value, { titleOf: store.titleOf }), 300);
    ta.addEventListener("input", doPreview); doPreview();
    v.appendChild(el("div", { class: "editgrid" }, [
      el("div", {}, [
        el("div", { class: "row gap" }, [el("label", { text: "Status" }), status, el("label", { text: "Prereqs" }), prereqs, el("label", { text: "Related" }), related]),
        ta,
        el("div", { class: "row gap" }, [
          el("button", { class: "btn primary", text: "💾 Save", onClick: save }),
          el("button", { class: "btn", text: "Cancel", onClick: () => (location.hash = "#/note/" + encodeURIComponent(id)) }),
        ]),
      ]),
      el("div", {}, [el("div", { class: "muted small", text: "Live preview" }), preview]),
    ]));
    mount(v);
    function save() {
      const splitIds = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
      store.saveNote(id, {
        body: ta.value, status: status.value, model: note.model || "manual",
        prereqs: splitIds(prereqs.value), related: splitIds(related.value),
        rating: note.rating || 1200,
      }).then(() => { toast("Saved", "ok"); location.hash = "#/note/" + encodeURIComponent(id); });
    }
  }

  async function regenerate(id) {
    let hint = "";
    const note = store.getNote(id);
    if (note) hint = prompt("Regenerate — optional emphasis (e.g. 'more depth', 'simpler', 'different angle'):", "") || "";
    toast("Generating…", "info");
    try {
      const { body, model } = await GP.generate.note(id, hint);
      await store.saveNote(id, { body, model, status: "draft", rating: (note && note.rating) || 1200, prereqs: note ? note.prereqs : [], related: note ? note.related : [] });
      toast(model === "demo" ? "Demo note created (configure Azure for real generation)" : "Note generated", "ok");
      route();
    } catch (e) { toast("Generation failed: " + e.message, "warn"); }
  }
  async function quickGenerate(id) { await regenerate(id); if (!location.hash.includes(id)) location.hash = "#/note/" + encodeURIComponent(id); }

  // ---- Book / continuous view ---------------------------------------------
  function book(subjectId) {
    const v = el("div", { class: "page book" });
    let ids = store.getStudyPath();
    if (subjectId) { const set = new Set([subjectId, ...store.descendants(subjectId).map((n) => n.id)]); ids = ids.filter((id) => set.has(id)); }
    ids = ids.filter((id) => store.getNote(id));
    v.appendChild(el("h1", { text: subjectId ? store.titleOf(subjectId) + " — sequence" : "Study path — continuous read" }));
    if (!ids.length) { v.appendChild(el("p", { class: "muted", text: "No notes on this path yet. Generate some, or set a study path in the Tree editor." })); return v; }
    const layout = el("div", { class: "booklayout" });
    const toc = el("nav", { class: "toc" }, [el("div", { class: "muted small", text: "Contents" })]);
    const content = el("div", { class: "bookcontent" });
    ids.forEach((id, i) => {
      const anchor = "b-" + i;
      toc.appendChild(el("a", { href: "#" + anchor, text: (i + 1) + ". " + store.titleOf(id) }));
      const sec = el("section", { class: "bookitem", id: anchor });
      sec.appendChild(el("h2", {}, [el("a", { href: "#/note/" + encodeURIComponent(id), text: store.titleOf(id) })]));
      const art = el("article", { class: "md" });
      GP.md.renderInto(art, store.getNote(id).body || "", { titleOf: store.titleOf });
      sec.appendChild(art);
      content.appendChild(sec);
    });
    layout.appendChild(toc); layout.appendChild(content);
    v.appendChild(layout);
    return v;
  }

  // ---- Quiz ----------------------------------------------------------------
  const quizState = { queue: [], idx: 0, scope: null };
  function quiz(params) {
    const v = el("div", { class: "page quiz" });
    const scope = params && params.node;
    let qs = scope ? store.questionsFor(scope) : store.state.questions.slice();
    // weakest node first; within a node, easy→hard so a calibration set ladders up
    qs.sort((a, b) => (store.ratingOf(a.node_id) - store.ratingOf(b.node_id))
      || ((a.difficulty_elo || 1200) - (b.difficulty_elo || 1200)) || (Math.random() - 0.5));
    if (!qs.length) {
      v.appendChild(el("h1", { text: "Quiz" }));
      v.appendChild(el("div", { class: "empty" }, [
        el("p", { text: scope ? "No questions for this topic yet." : "No questions yet — open a topic and generate a set." }),
        scope ? el("button", { class: "btn primary", text: "🎯 Generate a 10-question set (varied difficulty)", onClick: () => genQuestionSet(scope, 10) }) : null,
        scope ? el("button", { class: "btn", text: "✨ Just one", onClick: () => genQuestion(scope) }) : null,
      ]));
      return v;
    }
    quizState.queue = qs; quizState.idx = 0; quizState.scope = scope || null;
    renderQuestion(v);
    return v;
  }
  function genQuestion(nodeId) {
    toast("Generating question…", "info");
    GP.generate.question(nodeId).then((q) => store.addQuestion(q)).then(() => { toast("Question added", "ok"); route(); })
      .catch((e) => toast("Failed: " + e.message, "warn"));
  }
  function renderQuestion(v) {
    v.innerHTML = "";
    const q = quizState.queue[quizState.idx];
    v.appendChild(el("div", { class: "row spread" }, [
      el("h1", { text: "Quiz" }),
      el("span", { class: "muted", text: (quizState.idx + 1) + " / " + quizState.queue.length }),
    ]));
    v.appendChild(el("div", { class: "muted small", text: store.titleOf(q.node_id) + " · " + q.type + " · ★" + store.ratingOf(q.node_id) }));
    const stem = el("div", { class: "md stem" }); GP.md.renderInto(stem, q.stem_md, { titleOf: store.titleOf }); v.appendChild(stem);

    const answerArea = el("div", { class: "answers" });
    let getGiven;
    if (q.type === "NAT") {
      const inp = el("input", { class: "inp", type: "number", step: "any", placeholder: "numeric answer" });
      answerArea.appendChild(inp); getGiven = () => parseFloat(inp.value);
    } else {
      const inputType = q.type === "MSQ" ? "checkbox" : "radio";
      (q.options || []).forEach((o) => {
        const optId = "opt-" + o.id;
        const inp = el("input", { type: inputType, name: "opt", id: optId, value: o.id });
        const lab = el("label", { class: "opt", for: optId });
        lab.appendChild(inp);
        const span = el("span", { class: "md inline" }); GP.md.renderInto(span, o.md, {}); lab.appendChild(span);
        answerArea.appendChild(lab);
      });
      getGiven = () => Array.from(answerArea.querySelectorAll("input:checked")).map((i) => i.value);
    }
    v.appendChild(answerArea);

    const result = el("div", { class: "result" });
    const submit = el("button", { class: "btn primary", text: "Submit", onClick: () => {
      const given = getGiven();
      const correct = grade(q, given);
      const before = store.ratingOf(q.node_id);
      const upd = GP.elo.update(before, q.difficulty_elo || 1200, correct ? 1 : 0, store.state.attempts[q.node_id] || 0);
      store.recordAttempt(q.node_id, upd.learner);
      result.innerHTML = "";
      result.appendChild(el("div", { class: "verdict " + (correct ? "ok" : "no"), text: correct ? "✓ Correct" : "✗ Incorrect" }));
      result.appendChild(el("div", { class: "muted small", text: "Rating " + before + " → " + upd.learner }));
      const sol = el("div", { class: "md solution" }); GP.md.renderInto(sol, "**Solution.** " + (q.solution_md || ""), { titleOf: store.titleOf }); result.appendChild(sol);
      if (!correct) result.appendChild(el("a", { class: "btn", href: "#/note/" + encodeURIComponent(q.node_id), text: "Review the note ↗" }));
      submit.disabled = true;
    }});
    v.appendChild(submit);
    v.appendChild(result);
    const nav = el("div", { class: "prevnext" }, [
      el("span", {}),
      quizState.idx + 1 < quizState.queue.length
        ? el("button", { class: "btn", text: "Next →", onClick: () => { quizState.idx++; renderQuestion(v); } })
        : el("a", { class: "btn", href: "#/", text: "Finish" }),
    ]);
    v.appendChild(nav);
  }
  function grade(q, given) {
    if (q.type === "NAT") {
      const a = q.answer || {}; const tol = a.tol || 0;
      return typeof given === "number" && !isNaN(given) && Math.abs(given - a.value) <= tol;
    }
    const want = (q.answer || []).slice().sort().join(",");
    const got = (given || []).slice().sort().join(",");
    return want === got && want !== "";
  }

  // ---- Tree editor ---------------------------------------------------------
  function treeEditor() {
    const v = el("div", { class: "page" });
    v.appendChild(el("div", { class: "row spread" }, [
      el("h1", { text: "Edit topic tree" }),
      el("button", { class: "btn primary", text: "+ Add subject", onClick: () => addUnder(null) }),
    ]));
    v.appendChild(el("p", { class: "muted small", text: "Add / rename / delete main topics, subtopics and learning points. Each change commits to the private repo when GitHub is unlocked." }));
    v.appendChild(editorList(null));
    return v;
  }
  function editorList(rootId) {
    const ul = el("ul", { class: "tree editor-tree" });
    store.childrenOf(rootId).forEach((n) => ul.appendChild(editorItem(n)));
    return ul;
  }
  function editorItem(n) {
    const li = el("li", { class: "tnode open" });
    const row = el("div", { class: "trow lvl-" + n.level });
    row.appendChild(el("span", { class: "tlabel", text: n.title }));
    row.appendChild(levelBadge(n.level));
    const canChild = n.level !== "learning_point";
    if (canChild) row.appendChild(el("button", { class: "mini", title: "add child", text: "＋", onClick: () => addUnder(n.id) }));
    row.appendChild(el("button", { class: "mini", title: "rename", text: "✎", onClick: () => {
      const t = prompt("Rename topic:", n.title); if (t && t.trim()) store.renameNode(n.id, t.trim()).then(route);
    }}));
    row.appendChild(el("button", { class: "mini danger", title: "delete", text: "🗑", onClick: () => {
      const kids = store.descendants(n.id).length;
      if (confirm("Delete \"" + n.title + "\"" + (kids ? " and its " + kids + " descendants" : "") + "?")) store.deleteNode(n.id).then(route);
    }}));
    li.appendChild(row);
    const kids = store.childrenOf(n.id);
    if (kids.length) { const sub = el("div", { class: "children" }); kids.forEach((c) => sub.appendChild(editorItem(c))); li.appendChild(sub); }
    return li;
  }
  function addUnder(parentId) {
    const t = prompt("New " + (parentId ? "topic" : "subject") + " title:", ""); if (!t || !t.trim()) return;
    store.addNode(parentId, t.trim()).then(route);
  }

  // ---- Search --------------------------------------------------------------
  function searchView(q) {
    const v = el("div", { class: "page" });
    v.appendChild(el("h1", { text: "Search" }));
    const inp = el("input", { class: "inp big", placeholder: "search topics & notes…", value: q || "" });
    v.appendChild(inp);
    const results = el("div", { class: "results" });
    v.appendChild(results);
    const run = GP.lib.debounce(() => {
      const rs = store.search(inp.value); results.innerHTML = "";
      if (!inp.value.trim()) return;
      if (!rs.length) { results.appendChild(el("p", { class: "muted", text: "No matches." })); return; }
      rs.forEach((r) => results.appendChild(el("a", { class: "result", href: "#/note/" + encodeURIComponent(r.id) }, [
        el("span", { class: "tlabel", text: r.title }), levelBadge(r.level),
        r.hasNote ? el("span", { class: "chip has", text: "📝" }) : el("span", { class: "chip", text: "—" }),
        el("span", { class: "muted small", text: r.id }),
      ])));
    }, 200);
    inp.addEventListener("input", run); if (q) run();
    setTimeout(() => inp.focus(), 30);
    return v;
  }

  // ---- Settings ------------------------------------------------------------
  function settings() {
    const s = store.state.settings;
    const v = el("div", { class: "page settings" });
    v.appendChild(el("h1", { text: "Settings" }));

    const field = (label, node, hint) => el("div", { class: "field" }, [el("label", { text: label }), node, hint ? el("div", { class: "muted small", text: hint }) : null]);
    const input = (key, ph) => { const i = el("input", { class: "inp", value: s[key] || "", placeholder: ph || "" }); i.dataset.key = key; return i; };

    // GitHub
    const gh = el("div", { class: "card" }, [el("h3", { text: "GitHub (private data repo)" })]);
    gh.appendChild(field("Owner", input("dataOwner", "your-username")));
    gh.appendChild(field("Repo", input("dataRepo", "gate-prep-data")));
    gh.appendChild(field("Branch", input("dataBranch", "main")));
    gh.appendChild(field("Public pat.enc.json URL", input("patBlobUrl", "https://you.github.io/gate-prep/pat.enc.json"), "Where the unlock screen fetches your encrypted secrets from."));
    gh.appendChild(el("div", { class: "row gap" }, [
      el("button", { class: "btn", text: "Test connection", onClick: () => {
        saveFrom(v); GP.github.testConnection().then((r) => toast("OK — " + r.full_name + (r.private ? " (private)" : ""), "ok")).catch((e) => toast(e.message, "warn"));
      }}),
      el("button", { class: "btn primary", text: "⬆ Push all to repo", onClick: () => {
        saveFrom(v); toast("Pushing everything to the repo…", "info");
        store.pushAllToRepo().then((sha) => toast("Pushed. Commit " + String(sha).slice(0, 7) + " — check your repo.", "ok")).catch((e) => toast("Push failed: " + e.message, "warn"));
      }}),
      el("button", { class: "btn", text: "Pull from repo", onClick: () => { saveFrom(v); store.pullFromRepo().then(() => { toast("Pulled", "ok"); route(); }).catch((e) => toast(e.message, "warn")); } }),
    ]));
    gh.appendChild(el("div", { class: "muted small", text: "Push all writes syllabus_tree.json, study_path.json, all notes, questions and index.json in one commit (also initialises an empty repo). Individual note/tree edits commit automatically after that." }));
    v.appendChild(gh);

    // Azure / proxy
    const az = el("div", { class: "card" }, [el("h3", { text: "Azure Foundry via local proxy" })]);
    az.appendChild(field("Local proxy URL", input("proxyUrl", "http://localhost:8765")));
    az.appendChild(field("Foundry base URL (Claude)", input("foundryBaseUrl", "https://<resource>.services.ai.azure.com/anthropic/"), "The AnthropicFoundry base_url — the app appends /v1/messages."));
    az.appendChild(field("Claude deployment name", input("claudeModel", "claude-fable-5"), "Sent as the 'model' — your Foundry deployment name."));
    az.appendChild(field("GPT endpoint (optional, full URL)", input("gptEndpoint", "https://<resource>.services.ai.azure.com/openai/deployments/<dep>/chat/completions?api-version=2024-10-21")));
    const holdsKey = el("input", { type: "checkbox" }); holdsKey.dataset.key = "proxyHoldsKey"; if (s.proxyHoldsKey) holdsKey.checked = true;
    az.appendChild(el("label", { class: "row gap", style: "margin:.4rem 0" }, [holdsKey,
      el("span", { text: "Local proxy supplies the Azure key (recommended — key stays on your desktop via AZURE_API_KEY, never in pat.enc.json)" })]));
    const noThink = el("input", { type: "checkbox" }); noThink.dataset.key = "disableThinking"; if (s.disableThinking !== false) noThink.checked = true;
    az.appendChild(el("label", { class: "row gap", style: "margin:.4rem 0" }, [noThink,
      el("span", { text: "Disable extended thinking (faster, cheaper, reliable JSON — turn off only if the model rejects the parameter)" })]));
    const noteModel = el("select", { class: "inp" }); ["claude", "gpt"].forEach((m) => { const o = el("option", { value: m, text: m }); if (s.noteModel === m) o.selected = true; noteModel.appendChild(o); }); noteModel.dataset.key = "noteModel";
    const qModel = el("select", { class: "inp" }); ["gpt", "claude"].forEach((m) => { const o = el("option", { value: m, text: m }); if (s.questionModel === m) o.selected = true; qModel.appendChild(o); }); qModel.dataset.key = "questionModel";
    az.appendChild(field("Model for notes", noteModel));
    az.appendChild(field("Model for questions", qModel));
    az.appendChild(el("div", { class: "muted small", text: GP.generate.proxyConfigured() ? "✓ Proxy + endpoint + key present." : "Generation runs in DEMO mode until the proxy URL, Foundry base URL + deployment, and a key (or proxy-holds-key) are all set." }));
    const testOut = el("div", { class: "muted small", style: "margin-top:.4rem" });
    az.appendChild(el("button", { class: "btn", text: "🧪 Test generation", onClick: () => {
      saveFrom(v); testOut.textContent = "Testing (browser → proxy → Foundry)…"; testOut.className = "muted small";
      GP.generate.test()
        .then((r) => { testOut.textContent = "✓ " + r.provider + " replied: " + r.text; testOut.className = "small ok-text"; })
        .catch((e) => { testOut.textContent = "✗ " + e.message; testOut.className = "small warn-text"; });
    } }));
    az.appendChild(testOut);
    v.appendChild(az);

    // Secrets blob tool
    v.appendChild(secretsTool());

    // Data
    const data = el("div", { class: "card" }, [el("h3", { text: "Data & cache" })]);
    data.appendChild(el("div", { class: "row gap" }, [
      el("button", { class: "btn", text: "Download index.json", onClick: () => download("index.json", JSON.stringify(store.buildIndex(), null, 2)) }),
      el("button", { class: "btn", text: "Download syllabus_tree.json", onClick: () => download("syllabus_tree.json", JSON.stringify(store.state.syllabus, null, 2)) }),
      el("button", { class: "btn", text: "Rebuild cache from repo", onClick: () => store.rebuildCacheFromRepo().then(() => { toast("Cache rebuilt", "ok"); route(); }).catch((e) => toast(e.message, "warn")) }),
    ]));
    v.appendChild(data);

    const gen = el("div", { class: "card" }, [el("h3", { text: "Batch generation (whole syllabus)" })]);
    gen.appendChild(el("div", { class: "row gap" }, [
      el("button", { class: "btn", text: "✨ Missing notes", onClick: () => { saveFrom(v); batchForScope(null, "notes", "missing"); } }),
      el("button", { class: "btn", text: "✨ All notes", onClick: () => { saveFrom(v); batchForScope(null, "notes", "all"); } }),
      el("button", { class: "btn", text: "❓ 10 Q/topic (missing)", onClick: () => { saveFrom(v); batchForScope(null, "questions", "missing"); } }),
      el("button", { class: "btn", text: "❓ 10 Q/topic (all)", onClick: () => { saveFrom(v); batchForScope(null, "questions", "all"); } }),
    ]));
    gen.appendChild(el("div", { class: "muted small", text: "Across every leaf topic in the syllabus. '10 Q/topic' generates a low→high difficulty ladder per topic. Easily 100s of model calls — mind the time and Azure cost. Commits once at the end. (Per-subject buttons live on each subject page.)" }));
    v.appendChild(gen);

    v.appendChild(el("div", { class: "row gap sticky-save" }, [
      el("button", { class: "btn primary", text: "💾 Save settings", onClick: () => { saveFrom(v); toast("Saved", "ok"); } }),
      store.isUnlocked() ? el("button", { class: "btn", text: "🔒 Lock (clear secrets)", onClick: () => { store.lock(); toast("Locked", "ok"); route(); } }) : null,
    ]));
    return v;
  }
  function saveFrom(root) {
    const patch = {};
    root.querySelectorAll("[data-key]").forEach((i) => {
      patch[i.dataset.key] = i.type === "checkbox" ? i.checked : i.value.trim();
    });
    store.saveSettings(patch);
  }
  function secretsTool() {
    const card = el("div", { class: "card" }, [el("h3", { text: "Create encrypted secrets blob (one-time setup)" }),
      el("p", { class: "muted small", text: "Encrypt your PAT (+ optional Azure key) under a passphrase. Commit the resulting pat.enc.json to your PUBLIC app repo, then unlock from anywhere with just the passphrase." })]);
    const pat = el("input", { class: "inp", type: "password", placeholder: "GitHub fine-grained PAT (data repo, Contents RW)" });
    const key = el("input", { class: "inp", type: "password", placeholder: "Azure key (leave blank — prefer letting the proxy hold it)" });
    const exp = el("input", { class: "inp", type: "date" });
    const pass = el("input", { class: "inp", type: "password", placeholder: "passphrase (long!)" });
    const meter = el("div", { class: "muted small", text: "" });
    pass.addEventListener("input", () => { const st = GP.crypto.passphraseStrength(pass.value); meter.textContent = "strength: " + st.label; meter.className = "muted small " + (st.ok ? "ok-text" : "warn-text"); });
    card.appendChild(pat); card.appendChild(key); card.appendChild(el("label", { class: "muted small", text: "PAT expiry (reminder)" })); card.appendChild(exp); card.appendChild(pass); card.appendChild(meter);
    card.appendChild(el("button", { class: "btn primary", text: "Encrypt → download pat.enc.json", onClick: async () => {
      const st = GP.crypto.passphraseStrength(pass.value);
      if (!st.ok) { if (!confirm("Passphrase is " + st.label + ". Continue anyway? (public blob = brute-force risk)")) return; }
      if (!pat.value) { toast("PAT required", "warn"); return; }
      try {
        const blob = await GP.crypto.encryptSecrets({ pat: pat.value, azureKey: key.value || undefined, pat_expires: exp.value || undefined }, pass.value);
        download("pat.enc.json", JSON.stringify(blob, null, 2));
        toast("Encrypted. Commit pat.enc.json to your PUBLIC repo.", "ok");
      } catch (e) { toast(e.message, "warn"); }
    }}));
    return card;
  }
  function download(name, text) {
    const a = el("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---- mount + router glue -------------------------------------------------
  function mount(node) { const host = GP.lib.$("#view"); host.innerHTML = ""; host.appendChild(node); window.scrollTo(0, 0); }

  function parseHash() {
    const raw = (location.hash || "#/").slice(1);
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean); // ['note','id']
    const params = {}; (query || "").split("&").forEach((kv) => { const [k, val] = kv.split("="); if (k) params[k] = decodeURIComponent(val || ""); });
    return { parts, params };
  }
  function route() {
    const { parts, params } = parseHash();
    const [head, arg] = parts;
    try {
      if (!head || head === "home") return mount(home());
      if (head === "subject") return mount(subject(decodeURIComponent(arg || "")));
      if (head === "note") return mount(notePage(decodeURIComponent(arg || "")));
      if (head === "book") return mount(book(arg ? decodeURIComponent(arg) : null));
      if (head === "quiz") return mount(quiz(params));
      if (head === "tree") return mount(treeEditor());
      if (head === "search") return mount(searchView(params.q || ""));
      if (head === "settings") return mount(settings());
      mount(home());
    } catch (e) { console.error(e); mount(el("div", { class: "page" }, [el("h1", { text: "Error" }), el("pre", { text: e.stack || e.message })])); }
  }

  GP.views = { route, mount, editNote };
  // editNote mounts itself; expose route for app.js
})();
