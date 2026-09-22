/* app.js — bootstrap: shell (header/nav/theme), unlock modal, router. */
(function () {
  const GP = (window.GP = window.GP || {});
  const { el, $, toast } = GP.lib;

  function applyTheme(t) {
    document.documentElement.classList.toggle("dark", t !== "light");
  }

  function header() {
    const s = GP.store.state.settings;
    const nav = el("nav", { class: "topnav" }, [
      el("a", { class: "brand", href: "#/", html: "🎓 <b>GATE</b> Prep" }),
      el("a", { class: "navlink", href: "#/", text: "Home" }),
      el("a", { class: "navlink", href: "#/book", text: "Read" }),
      el("a", { class: "navlink", href: "#/quiz", text: "Quiz" }),
      el("a", { class: "navlink", href: "#/tree", text: "Edit tree" }),
      el("a", { class: "navlink", href: "#/settings", text: "Settings" }),
    ]);
    const search = el("input", { class: "topsearch", placeholder: "Search…  (/)" });
    search.addEventListener("keydown", (e) => { if (e.key === "Enter") location.hash = "#/search?q=" + encodeURIComponent(search.value); });
    const lockBtn = el("button", { class: "iconbtn", title: "lock/unlock" });
    function refreshLock() {
      const on = GP.store.isUnlocked();
      lockBtn.innerHTML = on ? "🔓" : "🔒";
      lockBtn.title = on ? "Unlocked — click to lock" : "Locked — click to unlock";
      lockBtn.classList.toggle("unlocked", on);
    }
    lockBtn.addEventListener("click", () => { if (GP.store.isUnlocked()) { GP.store.lock(); refreshLock(); GP.views.route(); toast("Locked", "ok"); } else openUnlock(refreshLock); });
    const themeBtn = el("button", { class: "iconbtn", title: "theme", text: "🌓" });
    themeBtn.addEventListener("click", () => {
      const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
      applyTheme(next); GP.store.saveSettings({ theme: next });
    });
    refreshLock();
    return el("header", { class: "appbar" }, [nav, el("div", { class: "spacer" }), search, lockBtn, themeBtn]);
  }

  function openUnlock(after) {
    const s = GP.store.state.settings;
    const overlay = el("div", { class: "overlay" });
    const pass = el("input", { class: "inp big", type: "password", placeholder: "passphrase" });
    const status = el("div", { class: "muted small" });
    let localBlob = null;
    const fileInp = el("input", { type: "file", accept: ".json", class: "hidden" });
    fileInp.addEventListener("change", async () => { try { localBlob = JSON.parse(await fileInp.files[0].text()); status.textContent = "Loaded pat.enc.json from file."; } catch (e) { status.textContent = "Bad file."; } });

    async function fetchBlob() {
      if (localBlob) return localBlob;
      const candidates = [s.patBlobUrl, "./pat.enc.json", "../pat.enc.json"].filter(Boolean);
      for (const url of candidates) {
        try { const r = await fetch(url, { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) {}
      }
      throw new Error("No pat.enc.json found — set its URL in Settings, or load the file.");
    }
    async function doUnlock() {
      status.textContent = "Deriving key (Argon2id, a few seconds)…";
      try {
        const blob = await fetchBlob();
        const secrets = await GP.crypto.decryptSecrets(blob, pass.value);
        GP.store.setSecrets(secrets);
        if (blob.pat_expires) {
          const days = Math.round((new Date(blob.pat_expires) - Date.now()) / 86400000);
          if (days < 0) toast("Your PAT has expired — re-run setup.", "warn");
          else if (days < 10) toast("PAT expires in " + days + " day(s) — rotate soon.", "warn");
        }
        toast("Unlocked", "ok");
        overlay.remove();
        if (GP.store.githubReady()) GP.store.pullFromRepo().then(() => GP.views.route()).catch(() => {});
        after && after(); GP.views.route();
      } catch (e) { status.textContent = "✗ " + e.message; }
    }
    pass.addEventListener("keydown", (e) => { if (e.key === "Enter") doUnlock(); });

    const box = el("div", { class: "modal" }, [
      el("h2", { text: "Unlock" }),
      el("p", { class: "muted small", text: "Enter your passphrase to decrypt your GitHub/Azure secrets for this session." }),
      pass,
      el("div", { class: "row gap" }, [
        el("button", { class: "btn primary", text: "Unlock", onClick: doUnlock }),
        el("button", { class: "btn", text: "Load pat.enc.json…", onClick: () => fileInp.click() }),
        el("button", { class: "btn ghost", text: "Skip (demo)", onClick: () => { overlay.remove(); after && after(); } }),
      ]),
      fileInp, status,
      el("p", { class: "muted small", html: 'First time? Create your encrypted blob in <a href="#/settings">Settings</a>.' }),
    ]);
    overlay.appendChild(box);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    setTimeout(() => pass.focus(), 30);
  }

  async function boot() {
    await GP.store.init();
    applyTheme(GP.store.state.settings.theme);
    const root = $("#app");
    root.innerHTML = "";
    root.appendChild(header());
    root.appendChild(el("main", { id: "view" }));
    window.addEventListener("hashchange", GP.views.route);
    // keyboard: "/" focuses search
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault(); const si = document.querySelector(".topsearch"); si && si.focus();
      }
    });
    GP.views.route();
  }

  GP.app = { openUnlock, boot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
