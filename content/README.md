# content/ — mirror of the PRIVATE data repo

This folder shows the on-disk format your **private** `gate-prep-data` repo uses.
The running app treats these files (in the private repo) as the source of truth;
the browser's IndexedDB is only a rebuildable cache.

```
syllabus_tree.json     # nested topic tree (main → subtopic → learning point)
study_path.json        # ordered node_ids = your reading sequence
index.json             # generated manifest (Settings → Download index.json)
notes/<a>/<b>/<c>/note.md          # one markdown note per node (id a.b.c)
questions/<a>/<b>/q-<id>.json      # one question/PYQ per file
```

- `syllabus_tree.json` here is regenerated from `app/data/seed.js` via
  `scripts/build-data.html` (so the syllabus lives in exactly one place).
- `notes/toc/regular/pumping/note.md` and
  `questions/toc/regular/q-toc-regular-001.json` are worked examples of the
  format (frontmatter fields; markdown with `$KaTeX$`, Mermaid, `[[wiki-links]]`).

When you wire up GitHub in the app's Settings, put these in the private repo's
root; the app reads/writes them via the GitHub API.
