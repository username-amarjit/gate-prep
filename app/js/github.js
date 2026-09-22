/* github.js — read the private data repo via REST, write via the Git Data API.
 *
 * Reads: Trees API to list, Blobs API to fetch. Writes: blobs -> tree
 * (on top of the current tree) -> commit -> update ref, so a note plus its
 * assets plus index.json land in ONE atomic commit.
 *
 * Node id <-> path:  toc.regular.pumping  <->  notes/toc/regular/pumping/note.md
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const { enc, dec, bytesToB64, b64ToBytes } = GP.lib;
  const API = "https://api.github.com";

  const S = () => GP.store.state.settings;
  const PAT = () => (GP.store.state.secrets || {}).pat;

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(API + path, Object.assign({}, opts, {
      headers: Object.assign({
        Authorization: "Bearer " + PAT(),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }, opts.headers || {}),
    }));
    if (!res.ok) {
      let detail = ""; try { detail = (await res.json()).message; } catch (e) {}
      throw new Error("GitHub " + res.status + (detail ? ": " + detail : ""));
    }
    return res.status === 204 ? null : res.json();
  }

  const repoPath = () => "/repos/" + S().dataOwner + "/" + S().dataRepo;
  const branch = () => S().dataBranch || "main";

  function decodeB64(b64) { return dec.decode(b64ToBytes((b64 || "").replace(/\s/g, ""))); }
  function idToNotePath(id) { return "notes/" + id.split(".").join("/") + "/note.md"; }
  function notePathToId(p) {
    const m = p.match(/^notes\/(.+)\/note\.md$/); return m ? m[1].split("/").join(".") : null;
  }
  function idToQuestionPath(nodeId, qid) { return "questions/" + nodeId.split(".").join("/") + "/q-" + qid + ".json"; }

  // ---- frontmatter (de)serialisation --------------------------------------
  function serializeNote(id, n) {
    const fm = {
      node_id: id, title: n.title || id, level: (GP.store.node(id) || {}).level || "learning_point",
      order: (GP.store.node(id) || {}).order != null ? GP.store.node(id).order : 0,
      status: n.status || "draft", rating: n.rating || 1200,
      model: n.model || "", updated: n.updated || new Date().toISOString().slice(0, 10),
      prereqs: n.prereqs || [], related: n.related || [],
    };
    let y;
    if (window.jsyaml) y = window.jsyaml.dump(fm).trim();
    else y = Object.keys(fm).map((k) => k + ": " + JSON.stringify(fm[k])).join("\n");
    return "---\n" + y + "\n---\n\n" + (n.body || "");
  }
  function parseNote(md) {
    const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) return { body: md };
    let fm = {};
    try { fm = window.jsyaml ? window.jsyaml.load(m[1]) || {} : {}; } catch (e) {}
    return Object.assign({}, fm, { body: m[2].replace(/^\n/, "") });
  }

  // ---- reads ---------------------------------------------------------------
  async function getRef() {
    const ref = await api(repoPath() + "/git/ref/heads/" + branch());
    const commit = await api(repoPath() + "/git/commits/" + ref.object.sha);
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  }
  async function getTree() {
    const { treeSha } = await getRef();
    return api(repoPath() + "/git/trees/" + treeSha + "?recursive=1");
  }
  async function getBlobText(sha) {
    const b = await api(repoPath() + "/git/blobs/" + sha);
    return decodeB64(b.content);
  }
  async function getFileText(path) {
    const data = await api(repoPath() + "/contents/" + path + "?ref=" + branch());
    return decodeB64(data.content);
  }

  async function pullAll() {
    const tree = await getTree();
    const out = { notes: {}, questions: [], syllabus: null, studyPath: null };
    const files = (tree.tree || []).filter((t) => t.type === "blob");
    // top-level json
    for (const name of ["syllabus_tree.json", "study_path.json"]) {
      const f = files.find((t) => t.path === name);
      if (f) {
        try {
          const txt = await getBlobText(f.sha); const json = JSON.parse(txt);
          if (name === "syllabus_tree.json") out.syllabus = json;
          else out.studyPath = json;
        } catch (e) { console.warn("parse " + name, e); }
      }
    }
    // notes + questions (bounded parallelism)
    const noteFiles = files.filter((t) => /^notes\/.+\/note\.md$/.test(t.path));
    const qFiles = files.filter((t) => /^questions\/.+\.json$/.test(t.path));
    await mapLimit(noteFiles, 6, async (f) => {
      const id = notePathToId(f.path); if (!id) return;
      try { out.notes[id] = parseNote(await getBlobText(f.sha)); } catch (e) {}
    });
    await mapLimit(qFiles, 6, async (f) => {
      try { out.questions.push(JSON.parse(await getBlobText(f.sha))); } catch (e) {}
    });
    return out;
  }

  async function mapLimit(arr, limit, fn) {
    const q = arr.slice(); const workers = [];
    for (let i = 0; i < limit; i++) {
      workers.push((async () => { while (q.length) await fn(q.shift()); })());
    }
    await Promise.all(workers);
  }

  // ---- writes (atomic multi-file commit) -----------------------------------
  // files: [{ path, content (string), delete? }]
  async function commitFiles(files, message) {
    if (!PAT()) throw new Error("Locked — unlock with your passphrase first.");
    const { commitSha, treeSha } = await getRef();
    const treeItems = [];
    for (const f of files) {
      if (f.delete) { treeItems.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
      const blob = await api(repoPath() + "/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: bytesToB64(enc.encode(f.content)), encoding: "base64" }),
      });
      treeItems.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const newTree = await api(repoPath() + "/git/trees", {
      method: "POST", body: JSON.stringify({ base_tree: treeSha, tree: treeItems }),
    });
    const commit = await api(repoPath() + "/git/commits", {
      method: "POST", body: JSON.stringify({ message: message || "update", tree: newTree.sha, parents: [commitSha] }),
    });
    await api(repoPath() + "/git/refs/heads/" + branch(), {
      method: "PATCH", body: JSON.stringify({ sha: commit.sha }),
    });
    return commit.sha;
  }

  const indexFile = () => ({ path: "index.json", content: JSON.stringify(GP.store.buildIndex(), null, 2) });

  async function commitNote(id, n) {
    return commitFiles([
      { path: idToNotePath(id), content: serializeNote(id, n) }, indexFile(),
    ], "note: " + id);
  }
  async function deleteNote(id) {
    return commitFiles([{ path: idToNotePath(id), delete: true }, indexFile()], "delete note: " + id);
  }
  async function commitQuestion(q) {
    return commitFiles([
      { path: idToQuestionPath(q.node_id, q.id), content: JSON.stringify(q, null, 2) }, indexFile(),
    ], "question: " + q.id);
  }
  async function commitTree(syllabus) {
    return commitFiles([
      { path: "syllabus_tree.json", content: JSON.stringify(syllabus, null, 2) }, indexFile(),
    ], "syllabus tree update");
  }
  async function commitStudyPath(sp) {
    return commitFiles([{ path: "study_path.json", content: JSON.stringify(sp, null, 2) }], "study path update");
  }

  // Verify the token + repo are reachable (used by Settings "Test").
  async function testConnection() {
    const info = await api(repoPath());
    return { ok: true, private: info.private, full_name: info.full_name };
  }

  GP.github = {
    pullAll, commitFiles, commitNote, deleteNote, commitQuestion, commitTree, commitStudyPath,
    testConnection, getFileText, serializeNote, parseNote,
    idToNotePath, notePathToId,
  };
})();
