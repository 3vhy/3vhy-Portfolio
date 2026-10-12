/* 3vhy portfolio — "Turtle Beach". Renders from content (live API → content.json fallback). */
(function () {
  "use strict";

  const PREVIEW = new URLSearchParams(location.search).has("preview");
  const app = document.getElementById("app");
  const PI = window.PixelIcons;
  const icon = (n, s) => PI.svg(n, s);
  let BASE = {};
  let T = {};

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function merge(base, over) {
    if (over === undefined || over === null) return base;
    if (!isObj(base) || !isObj(over)) return over;
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
    return out;
  }
  function safeUrl(u) {
    try { const x = new URL(u, location.href); return ["http:", "https:", "mailto:"].includes(x.protocol) ? x.href : "#"; }
    catch { return "#"; }
  }
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");
  const fmtMembers = (e) => (Number(e.members) || 0).toLocaleString("en-US") + (e.membersPlus ? "+" : "");
  const copyText = (addr) => String(addr || "").split(/\s+\/\s+|\s+/)[0];
  const discordUrl = (p) => (p.discordId ? `https://discord.com/users/${encodeURIComponent(p.discordId)}` : "#");
  function tokens(c, str) {
    const ex = c.experience || [];
    const total = ex.reduce((s, e) => s + (Number(e.members) || 0), 0);
    const map = {
      servers: String(new Set(ex.map((e) => String(e.server).toLowerCase())).size),
      members: total.toLocaleString("en-US") + (ex.some((e) => e.membersPlus) ? "+" : ""),
      current: String(ex.filter((e) => e.status === "current").length),
      past: String(ex.filter((e) => e.status !== "current").length),
    };
    return String(str ?? "").replace(/\{(\w+)(?::([\w-]+))?\}/g, (m, key, arg) =>
      key === "roles" ? String(ex.filter((e) => e.category === arg).length) : key in map ? map[key] : m);
  }
  function roleIcon(e) {
    if (e.icon) return e.icon;
    const r = String(e.role || "").toLowerCase();
    if (/owner|founder/.test(r)) return "crown";
    if (/admin/.test(r)) return "gear";
    if (/\bsr\b|senior|head/.test(r)) return "sword";
    if (/manager|\bmm\b|\bsm\b/.test(r)) return "book";
    if (/mod/.test(r)) return "shield";
    if (/helper|support|trial/.test(r)) return "heart";
    return "star";
  }

  /* ---------- colour + pixel helpers ---------- */
  function rgb(h) {
    const m = String(h || "").replace("#", "").match(/^([\da-f]{6}|[\da-f]{3})$/i);
    if (!m) return [239, 227, 184];
    let s = m[1]; if (s.length === 3) s = s.split("").map((x) => x + x).join("");
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  }
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  const texCache = {};
  function canvasTex(key, size, paint) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement("canvas"); c.width = c.height = size;
    paint(c.getContext("2d"), size);
    return (texCache[key] = `url(${c.toDataURL()})`);
  }
  const sandTex = (t) => canvasTex("sand" + t.sand + t.sandDark, 16, (x, n) => {
    const r = seeded(19), dark = t.sandDark, light = mix(t.sand, "#ffffff", 0.35);
    x.fillStyle = t.sand; x.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) {
      const v = r();
      if (v < 0.11) { x.fillStyle = dark; x.fillRect(i, y, 1, 1); }
      else if (v > 0.93) { x.fillStyle = light; x.fillRect(i, y, 1, 1); }
    }
  });
  // turtle-shell plates: offset rows of scutes with ink seams and a highlight
  const shellTex = (t) => canvasTex("shell" + t.shell + t.scute, 16, (x) => {
    x.fillStyle = t.ink; x.fillRect(0, 0, 16, 16);
    const plate = (px, py) => {
      x.fillStyle = t.scute; x.fillRect(px + 1, py + 1, 6, 6);
      x.fillStyle = t.shell; x.fillRect(px + 2, py + 2, 4, 4);
      x.fillStyle = t.turtle; x.fillRect(px + 1, py + 1, 3, 1); x.fillRect(px + 1, py + 1, 1, 2);
    };
    plate(0, 0); plate(8, 0); plate(-4, 8); plate(4, 8); plate(12, 8);
  });
  // draw a char-grid as an SVG (runs merged per row)
  function art(rows, pal, cls = "", label = "") {
    const w = rows[0].length, h = rows.length;
    let r = "";
    rows.forEach((row, y) => {
      let x = 0;
      while (x < w) {
        const ch = row[x];
        if (ch === "." || !pal[ch]) { x++; continue; }
        let n = 1; while (row[x + n] === ch) n++;
        r += `<rect x="${x}" y="${y}" width="${n}" height="1" style="fill:${pal[ch]}"/>`;
        x += n;
      }
    });
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" ${label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`}>${r}</svg>`;
  }
  const TURTLE = [
    ".......kkkkkkkk.......",
    ".....kkDdDdDdDdkk.....",
    "....kDdDdDdDdDdDdk....",
    "...kdDdDdDdDdDdDdDk.kk",
    "..kyyyyyyyyyyyyyyykLwk",
    "..kkkkkkkkkkkkkkkkkLLk",
    "...kLLk.......kLLk....",
    "...kLk.........kLk....",
    "...kk..........kk.....",
  ];
  const BOTTLE = [
    "....kkkk....", "....kbbk....", "....kbbk....", "....kkkk....", "....kcck....", "....kcck....",
    "...kccCck...", "..kccccCck..", ".kchcccccCk.", ".kchcwwwcCk.", ".kchwwewwCk.", ".kccwwewwCk.",
    ".kccwwwwcCk.", ".kcccwwccCk.", ".kcccccccCk.", ".kCcccccCCk.", "..kCCCCCCk..", "...kkkkkk...",
  ];
  const turtlePal = () => ({ k: "var(--ink)", D: "var(--shell)", d: "var(--scute)", y: "var(--egg)", L: "var(--turtle)", w: "#fff" });

  /* ---------- the beach scene (64×64 pixels) ---------- */
  function scene() {
    const N = 64, rnd = seeded(7);
    const shoreY = (x) => Math.round((64 - x * 0.55) / 2) * 2;
    const g = [];
    const light = mix(T.sea, "#ffffff", 0.25), deep = mix(T.sea, T.seaDeep, 0.55);
    for (let y = 0; y < N; y++) {
      const row = [];
      for (let x = 0; x < N; x++) {
        const s = shoreY(x);
        let c;
        if (y < s) { const v = rnd(); c = v < 0.12 ? T.sandDark : v > 0.95 ? mix(T.sand, "#ffffff", 0.4) : T.sand; if (y >= s - 2) c = mix(T.sand, T.sandDark, 0.6); }
        else if (y < s + 1) c = "#ffffff";
        else if (y < s + 4) c = light;
        else c = (y - s) > 14 ? deep : T.sea;
        if (y >= s + 4 && rnd() < 0.04) c = light;
        row.push(c);
      }
      g.push(row);
    }
    const put = (sprite, ox, oy, pal) => sprite.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) g[oy + j][ox + i] = pal[ch]; }));
    // the nest: turtle eggs half-buried in the sand
    const EGG = [".kkk.", "keeek", "keaek", "keeek", ".kkk."];
    const ep = { k: T.ink, e: T.egg, a: T.turtle };
    put(EGG, 12, 42, ep); put(EGG, 17, 41, ep); put(EGG, 15, 46, ep);
    // a few shells and pebbles
    [[16, 12], [44, 14], [36, 20], [52, 6], [26, 8]].forEach(([x, y]) => { g[y][x] = T.egg; g[y][x + 1] = T.sandDark; });
    // seagrass in deeper water
    [[56, 55, 7], [59, 57, 5], [48, 59, 4]].forEach(([x, y, h]) => { for (let i = 0; i < h && y - i >= 0; i++) g[y - i][x + (i % 3 === 1 ? 1 : 0)] = T.scute; });
    let r = "";
    g.forEach((row, y) => {
      let x = 0;
      while (x < N) { let n = 1; while (x + n < N && row[x + n] === row[x]) n++; r += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${row[x]}"/>`; x += n; }
    });
    return `<svg viewBox="0 0 64 64" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }

  /* ---------- theme ---------- */
  const FONT_URLS = { "Press Start 2P": "Press+Start+2P", "VT323": "VT323", "Silkscreen": "Silkscreen:wght@400;700", "Jersey 10": "Jersey+10", "Tiny5": "Tiny5" };
  function loadFonts(t) {
    const fams = [...new Set([t.headingFont, t.bodyFont])].filter((f) => FONT_URLS[f]);
    let l = document.getElementById("gfonts");
    if (!fams.length) { if (l) l.remove(); return; }
    const href = "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + FONT_URLS[f]).join("&") + "&display=swap";
    if (!l) { l = document.createElement("link"); l.id = "gfonts"; l.rel = "stylesheet"; document.head.append(l); }
    if (l.getAttribute("href") !== href) l.setAttribute("href", href);
  }
  const DEFAULT_T = { sand: "#efe3b8", sandDark: "#dccb92", paper: "#fbf5e1", shell: "#3f6b34", scute: "#6a9a45", turtle: "#9cc46b", sea: "#3e9db0", seaDeep: "#22647a", egg: "#f3eed7", wood: "#8b5a2b", ink: "#1d2b22", muted: "#5d5a44" };
  function applyTheme(t) {
    T = { ...DEFAULT_T, ...t };
    const r = document.documentElement.style;
    const map = { sand: "--sand", sandDark: "--sand-dark", paper: "--paper", shell: "--shell", scute: "--scute", turtle: "--turtle", sea: "--sea", seaDeep: "--sea-deep", egg: "--egg", wood: "--wood", ink: "--ink", muted: "--muted" };
    for (const [k, v] of Object.entries(map)) r.setProperty(v, T[k]);
    const fam = (f) => `"${f}", ui-monospace, monospace`;
    if (t.headingFont) r.setProperty("--font-head", fam(t.headingFont));
    if (t.bodyFont) r.setProperty("--font-body", fam(t.bodyFont));
    r.setProperty("--body-size", (Number(t.bodySize) || 16) + "px");
    r.setProperty("--sand-tex", t.texture === false ? "none" : sandTex(T));
    r.setProperty("--shell-tex", shellTex(T));
    document.body.classList.toggle("no-walker", t.walker === false);
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = T.sand;
    loadFonts(t);
  }

  /* ---------- sections ---------- */
  const secHead = (s) => `<header class="sec-head">${icon(s.icon || "turtle", 52)}<div><h2>${esc(s.title)}</h2>${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ""}</div></header>`;
  function navItems(c, secs) {
    const out = [];
    for (const s of secs) {
      if (s.id === "categories") (c.categories || []).forEach((cat) => out.push({ href: "#cat-" + cat.id, label: cat.navLabel || cat.title, icon: cat.icon }));
      else if (["about", "skills", "contact"].includes(s.id) && s.navLabel) out.push({ href: "#" + s.id, label: s.navLabel, icon: s.icon });
    }
    return out;
  }

  const B = {};
  B.hero = (c, s, secs) => {
    const p = c.profile || {};
    const first = (c.categories || [])[0];
    const stats = secs.some((x) => x.id === "stats") ? (c.stats || []).filter((x) => x.label || x.value) : [];
    const nav = navItems(c, secs);
    return `<div class="wrap topbar">
        <a class="brand" href="#top">${icon("turtle", 28)}<span>${esc(p.name)}</span></a>
        ${nav.length ? `<nav class="nav" aria-label="Sections">${nav.map((n) => `<a href="${esc(n.href)}">${icon(n.icon || "scute", 16)}${esc(n.label)}</a>`).join("")}</nav>` : ""}
      </div>
      <section class="hero" id="top"><div class="wrap hero-grid">
        <div>
          <h1 class="title">${esc(p.name)}</h1>
          <div>${p.showStatus !== false && p.status ? `<p class="status">${icon("turtle", 18)}${esc(p.status)}</p>` : ""}</div>
          ${p.tagline ? `<p class="tagline">${esc(p.tagline)}</p>` : ""}
          <div class="hero-actions">
            ${p.primaryButton && first ? `<a class="mc-btn" href="#cat-${esc(first.id)}">${esc(p.primaryButton)}</a>` : ""}
            ${p.secondaryButton && p.discordId ? `<a class="mc-btn alt" href="${esc(discordUrl(p))}" target="_blank" rel="noopener">${esc(p.secondaryButton)}</a>` : ""}
          </div>
          ${p.discordUsername || p.discordId ? `<p class="handle">
            ${p.discordUsername ? `<span>Discord <b>${esc(p.discordUsername)}</b><button class="chip-btn" type="button" data-copy="${esc(p.discordUsername)}">copy</button></span>` : ""}
            ${p.discordId ? `<span>ID <b>${esc(p.discordId)}</b><button class="chip-btn" type="button" data-copy="${esc(p.discordId)}">copy</button></span>` : ""}
          </p>` : ""}
          ${stats.length ? `<div class="stats">${stats.map((x) => `<div class="stat">${icon(x.icon || "egg", 40)}<b>${esc(tokens(c, x.value))}</b><span>${esc(x.label)}</span></div>`).join("")}</div>` : ""}
        </div>
        <div class="scene">
          ${scene()}
          <span class="mama">${art(TURTLE, turtlePal())}</span>
          <span class="baby">${art(TURTLE, turtlePal())}</span>
        </div>
      </div></section>`;
  };
  B.stats = () => "";

  B.about = (c, s) => {
    const paras = String(c.about || "").split(/\n\s*\n/).filter((x) => x.trim());
    if (!paras.length) return "";
    return `<section class="sec" id="about"><div class="wrap">${secHead(s)}
      <div class="about">${paras.map((x) => `<p>${inline(x.trim())}</p>`).join("")}</div></div></section>`;
  };

  function card(e) {
    return `<article class="card"><div class="card-shell"></div>
      <div class="card-body">
        ${e.iconUrl ? `<img src="${esc(safeUrl(e.iconUrl))}" alt="" width="44" height="44" class="pixelated">` : icon(roleIcon(e), 44)}
        <h3>${esc(e.role)}</h3>
        <p class="at">at <b>${esc(e.server)}</b></p>
        ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ""}
        <div class="meta">
          <span class="tag now">Current</span>
          ${Number(e.members) ? `<span class="tag">${esc(fmtMembers(e))} members</span>` : ""}
          ${e.address ? `<button class="addr" type="button" data-copy="${esc(copyText(e.address))}">${esc(e.address)}</button>` : ""}
          ${e.period ? `<span class="tag">${esc(e.period)}</span>` : ""}
        </div>
      </div></article>`;
  }
  function egg(e) {
    const extra = [e.note, e.period, Number(e.members) ? fmtMembers(e) + " members" : ""].filter(Boolean).join(", ");
    return `<div class="egg">${icon("egg", 40)}<div>
      <span class="r">${esc(e.role)}</span>
      <span class="s">at ${esc(e.server)}</span>
      ${e.address ? `<button class="addr" type="button" data-copy="${esc(copyText(e.address))}">${esc(e.address)}</button>` : ""}
      ${extra ? `<span class="tag">${esc(extra)}</span>` : ""}</div></div>`;
  }
  B.categories = (c) => (c.categories || []).map((cat) => {
    const items = (c.experience || []).filter((e) => e.category === cat.id);
    const cur = items.filter((e) => e.status === "current");
    const past = items.filter((e) => e.status !== "current");
    return `<section class="sec" id="cat-${esc(cat.id)}"><div class="wrap">${secHead(cat)}
      ${cur.length ? `<h3 class="sub">${esc(cat.currentTitle || "Right now")}</h3><div class="cards">${cur.map(card).join("")}</div>` : ""}
      ${past.length ? `<h3 class="sub">${esc(cat.pastTitle || "Previous servers")} <small>${past.length} ${past.length === 1 ? "server" : "servers"}</small></h3><div class="nest">${past.map(egg).join("")}</div>` : ""}
      ${!items.length ? `<p>No servers here yet.</p>` : ""}
    </div></section>`;
  }).join("");

  B.skills = (c, s) => (c.skills || []).length ? `<section class="sec" id="skills"><div class="wrap">${secHead(s)}
    <div class="skills">${c.skills.map((k) => {
      const lv = Math.max(0, Math.min(5, Number(k.level) || 0));
      return `<div class="skill">${icon(k.icon || "scute", 40)}<div><h3>${esc(k.name)}</h3>
        ${lv ? `<div class="scutes" aria-label="${lv} out of 5">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= lv ? "" : "off"}">${icon("scute", 20)}</span>`).join("")}</div>` : ""}
        ${k.desc ? `<p>${esc(k.desc)}</p>` : ""}</div></div>`;
    }).join("")}</div></div></section>` : "";

  B.contact = (c, s) => {
    const p = c.profile || {}, ct = c.contact || {};
    const links = (ct.links || []).filter((l) => l.label && l.url);
    const bp = { k: "var(--ink)", b: "var(--wood)", c: mix(T.sea, "#ffffff", 0.55), C: mix(T.sea, "#ffffff", 0.2), h: "#ffffff", w: "var(--paper)", e: "var(--sand-dark)" };
    return `<section class="sea" id="contact"><div class="wrap">${secHead(s)}
      <div class="letter">${art(BOTTLE, bp, "bottle")}
        <div class="letter-text">
          ${ct.text ? `<p>${esc(ct.text)}</p>` : ""}
          ${p.discordUsername ? `<div class="to"><div><small>Discord</small><br><b>${esc(p.discordUsername)}</b></div><button class="chip-btn" type="button" data-copy="${esc(p.discordUsername)}">copy</button></div>` : ""}
          <div class="row">
            ${p.discordId ? `<a class="mc-btn" href="${esc(discordUrl(p))}" target="_blank" rel="noopener">Message on Discord</a>` : ""}
            ${links.map((l) => `<a class="mc-btn alt" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}
          </div>
        </div>
      </div></div></section>`;
  };

  /* ---------- the walking turtle ---------- */
  let shore = null, moveTimer;
  function ensureShore() {
    if (shore) return;
    shore = document.createElement("div");
    shore.className = "shore"; shore.setAttribute("aria-hidden", "true");
    shore.innerHTML = `<span class="walker">${art(TURTLE, turtlePal())}</span>`;
    document.body.append(shore);
  }
  function onScroll() {
    if (!shore) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    shore.style.setProperty("--p", Math.min(1, window.scrollY / max).toFixed(4));
    shore.classList.add("moving");
    clearTimeout(moveTimer); moveTimer = setTimeout(() => shore.classList.remove("moving"), 180);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- render ---------- */
  function render(c) {
    applyTheme(c.theme || {});
    if (c.meta) {
      if (c.meta.title) document.title = c.meta.title;
      const d = document.querySelector('meta[name="description"]'); if (d && c.meta.description) d.content = c.meta.description;
    }
    const secs = (c.sections || []).filter((s) => s.visible !== false);
    let html = "<main>";
    for (const s of secs) if (B[s.id]) html += B[s.id](c, s, secs);
    html += `</main><footer class="footer"><div class="wrap">${esc(c.footer)}</div></footer>`;
    app.innerHTML = html;
    ensureShore(); onScroll(); shore.classList.remove("moving");
  }

  /* ---------- copy ---------- */
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast"); if (!t) return;
    t.innerHTML = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-copy]"); if (!b) return;
    const val = b.getAttribute("data-copy");
    try { await navigator.clipboard.writeText(val); toast(`<b>Copied</b> ${esc(val)}`); }
    catch { toast(`Couldn't copy. Here it is: ${esc(val)}`); }
  });

  /* ---------- load ---------- */
  async function getJson(url) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return null;
      return await r.json();
    } catch { return null; }
  }
  async function init() {
    const [base, live] = await Promise.all([getJson("content.json"), getJson("/api/content")]);
    BASE = base || {};
    render(merge(BASE, live && live.content));
    if (PREVIEW && window.parent !== window) {
      window.addEventListener("message", (e) => {
        if (e.origin !== location.origin || !e.data || e.data.type !== "portfolio:preview") return;
        const y = window.scrollY;
        render(merge(BASE, e.data.content));
        window.scrollTo(0, y);
      });
      window.parent.postMessage({ type: "portfolio:ready" }, location.origin);
    }
  }
  init();
})();
