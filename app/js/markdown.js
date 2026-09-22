/* markdown.js — render note/question markdown safely, with wiki-links,
 * KaTeX math and Mermaid diagrams. Order matters:
 *   preprocess [[wiki]] -> marked -> DOMPurify -> mermaid -> KaTeX.
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const { esc } = GP.lib;

  let mermaidReady = false;
  function initMermaid() {
    if (mermaidReady || !window.mermaid) return;
    const dark = document.documentElement.classList.contains("dark");
    window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
    mermaidReady = true;
  }

  // [[node_id]] or [[node_id|label]] -> markdown link into the SPA router.
  function preprocessWikiLinks(md, titleOf) {
    return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
      id = id.trim();
      const text = (label && label.trim()) || (titleOf && titleOf(id)) || id;
      return `[${text}](#/note/${encodeURIComponent(id)})`;
    });
  }

  function renderInto(container, md, opts) {
    opts = opts || {};
    const src = preprocessWikiLinks(md || "", opts.titleOf);
    let html;
    if (window.marked) {
      html = window.marked.parse(src, { breaks: false, gfm: true });
    } else {
      html = "<pre>" + esc(src) + "</pre>";
    }
    const clean = window.DOMPurify
      ? window.DOMPurify.sanitize(html, { ADD_TAGS: ["foreignObject"], ADD_ATTR: ["target"] })
      : html;
    container.innerHTML = clean;
    enhance(container);
  }

  async function enhance(container) {
    // Mermaid: turn ```mermaid code blocks into rendered diagrams.
    initMermaid();
    if (window.mermaid) {
      const blocks = Array.from(container.querySelectorAll("code.language-mermaid"));
      for (let i = 0; i < blocks.length; i++) {
        const code = blocks[i];
        const pre = code.closest("pre") || code;
        const graph = code.textContent;
        const id = "mmd-" + Date.now() + "-" + i;
        try {
          const { svg } = await window.mermaid.render(id, graph);
          const wrap = document.createElement("div");
          wrap.className = "mermaid-rendered";
          wrap.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }) : svg;
          pre.replaceWith(wrap);
        } catch (e) {
          pre.classList.add("mermaid-error");
          pre.title = "Mermaid error: " + e.message;
        }
      }
    }
    // KaTeX math.
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (e) { /* ignore */ }
    }
    // Open external links in a new tab; keep in-app #/ links internal.
    container.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/^https?:/i.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
    });
  }

  GP.md = { renderInto, preprocessWikiLinks };
})();
