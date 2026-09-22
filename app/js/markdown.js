/* markdown.js — render note/question markdown safely.
 *
 * Order is the whole trick: we must render math and code BEFORE Markdown, or
 * `marked` mangles LaTeX (e.g. `x_i` underscores become <em>). So:
 *   preprocess [[wiki]] → stash code + KaTeX(math) as placeholders →
 *   marked → restore placeholders → DOMPurify → render Mermaid.
 * Mermaid uses htmlLabels:false so its labels are SVG <text> (survive sanitising).
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const esc = GP.lib.esc;

  let mermaidReady = false;
  function initMermaid() {
    if (mermaidReady || !window.mermaid) return;
    const dark = document.documentElement.classList.contains("dark");
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "default",
      htmlLabels: false,
      flowchart: { htmlLabels: false, useMaxWidth: true },
      er: { useMaxWidth: true },
      sequence: { useMaxWidth: true },
    });
    mermaidReady = true;
  }

  // [[node_id]] or [[node_id|label]] -> markdown link into the SPA router.
  function preprocessWikiLinks(md, titleOf) {
    return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
      id = id.trim();
      const text = (label && label.trim()) || (titleOf && titleOf(id)) || id;
      return "[" + text + "](#/note/" + encodeURIComponent(id) + ")";
    });
  }

  function katexHTML(tex, display) {
    if (!window.katex) return esc((display ? "$$" : "$") + tex + (display ? "$$" : "$"));
    try {
      return window.katex.renderToString(tex.trim(), { displayMode: !!display, throwOnError: false, output: "htmlAndMathml" });
    } catch (e) {
      return '<code class="katex-error" title="' + esc(e.message) + '">' + esc(tex) + "</code>";
    }
  }

  // Tags/attrs to keep so KaTeX (svg + mathml) and rendered content survive sanitising.
  const KEEP_TAGS = ["svg", "g", "path", "text", "tspan", "line", "rect", "use", "defs", "style",
    "math", "semantics", "mrow", "annotation", "mi", "mo", "mn", "msup", "msub", "msubsup",
    "mfrac", "msqrt", "mroot", "mspace", "mtext", "mover", "munder", "mtable", "mtr", "mtd", "mpadded"];
  const KEEP_ATTR = ["class", "style", "viewBox", "d", "transform", "x", "y", "x1", "y1", "x2", "y2",
    "width", "height", "fill", "stroke", "stroke-width", "text-anchor", "aria-hidden",
    "mathvariant", "encoding", "displaystyle", "scriptlevel", "preserveAspectRatio", "target", "rel"];

  function renderInto(container, md, opts) {
    opts = opts || {};
    const src = preprocessWikiLinks(md || "", opts.titleOf);
    const slots = [];
    const stash = (html) => "@@GP" + (slots.push(html) - 1) + "@@";
    // 1) protect fenced code (kept as real <pre><code> so Mermaid detection works)
    let t = src.replace(/```([\w-]*)[ \t]*\r?\n([\s\S]*?)```/g, (m, lang, code) =>
      stash('<pre><code class="language-' + esc(lang) + '">' + esc(code.replace(/\n$/, "")) + "</code></pre>"));
    // 2) protect inline code
    t = t.replace(/`([^`\n]+)`/g, (m, code) => stash("<code>" + esc(code) + "</code>"));
    // 3) render math NOW (display first, then inline) so Markdown can't touch it
    t = t.replace(/\$\$([\s\S]+?)\$\$/g, (m, tex) => stash(katexHTML(tex, true)));
    t = t.replace(/\$([^\n$]+?)\$/g, (m, tex) => stash(katexHTML(tex, false)));
    // 4) Markdown the remainder
    let html = window.marked ? window.marked.parse(t, { gfm: true, breaks: false }) : "<pre>" + esc(t) + "</pre>";
    // 5) restore protected pieces
    html = html.replace(/@@GP(\d+)@@/g, (m, i) => (slots[+i] != null ? slots[+i] : m));
    // 6) sanitise (keep KaTeX svg/mathml) and mount
    container.innerHTML = window.DOMPurify
      ? window.DOMPurify.sanitize(html, { ADD_TAGS: KEEP_TAGS, ADD_ATTR: KEEP_ATTR })
      : html;
    enhance(container);
  }

  async function enhance(container) {
    initMermaid();
    if (window.mermaid) {
      const blocks = Array.from(container.querySelectorAll("code.language-mermaid"));
      for (let i = 0; i < blocks.length; i++) {
        const code = blocks[i];
        const pre = code.closest("pre") || code;
        const graph = code.textContent;
        try {
          const { svg } = await window.mermaid.render("mmd-" + Date.now() + "-" + i, graph);
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
    // external links open in a new tab; in-app #/ links stay internal
    container.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/^https?:/i.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
    });
  }

  GP.md = { renderInto, preprocessWikiLinks };
})();
