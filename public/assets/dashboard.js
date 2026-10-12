/* Portfolio dashboard: edit everything, preview live, save to Netlify. */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const API = "/api/content";
  const PW_KEY = "portfolio_admin_pw";
  const ICONS = window.PixelIcons.names;
  const FONTS = [["Pixelify Sans", "Pixelify Sans (built in)"], ["Monocraft", "Monocraft (Minecraft-style, built in)"], "Press Start 2P", "VT323", "Silkscreen", "Jersey 10", "Tiny5"];
  const ROLE_ICONS = [["", "Auto (from the role name)"], ...window.PixelIcons.names.map((n) => [n, n])];
  const SECTION_NAMES = { hero: "Top of page (name and the beach)", stats: "Stats (under your name)", about: "About", categories: "Staff (shell cards and the egg nest)", skills: "Skills (scutes)", contact: "Contact (message in a bottle)" };
  const PRESETS = {
    Beach: { sand: "#efe3b8", sandDark: "#dccb92", paper: "#fbf5e1", shell: "#3f6b34", scute: "#6a9a45", turtle: "#9cc46b", sea: "#3e9db0", seaDeep: "#22647a", egg: "#f3eed7", wood: "#8b5a2b", ink: "#1d2b22", muted: "#5d5a44" },
    Lagoon: { sand: "#f2e9c9", sandDark: "#e0d29f", paper: "#fdf8e8", shell: "#2f6b5c", scute: "#4f9a83", turtle: "#8fd1b0", sea: "#2fb3c2", seaDeep: "#17707f", egg: "#f5f0dc", wood: "#8b5a2b", ink: "#14302a", muted: "#5a5a46" },
    Sunset: { sand: "#f3d9b1", sandDark: "#e2bf8c", paper: "#fdf3e3", shell: "#4d6b34", scute: "#7d9a45", turtle: "#b3c66b", sea: "#5d8fb0", seaDeep: "#3b5e85", egg: "#f6ecd8", wood: "#8b5a2b", ink: "#2b241d", muted: "#6a5640" },
    Mangrove: { sand: "#e4dcb4", sandDark: "#cdc28e", paper: "#f7f3e0", shell: "#2e4d2a", scute: "#4f7a3c", turtle: "#86ad5c", sea: "#3a8a8a", seaDeep: "#1f5757", egg: "#efebd3", wood: "#6e4a2a", ink: "#17231a", muted: "#545440" },
  };

  let base = {}, state = {}, snapshot = "", mode = "live", password = "", updatedAt = null;
  let tab = "profile";
  const openItems = new Set();

  /* ---------- utils ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function merge(b, o) {
    if (o === undefined || o === null) return b;
    if (!isObj(b) || !isObj(o)) return o;
    const out = { ...b };
    for (const k of Object.keys(o)) out[k] = merge(b[k], o[k]);
    return out;
  }
  const uid = () => Math.random().toString(36).slice(2, 9);
  const getP = (o, p) => p.reduce((x, k) => (x == null ? undefined : x[k]), o);
  function setP(o, p, v) {
    let x = o;
    for (let i = 0; i < p.length - 1; i++) {
      if (x[p[i]] == null) x[p[i]] = typeof p[i + 1] === "number" ? [] : {};
      x = x[p[i]];
    }
    x[p[p.length - 1]] = v;
  }
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600);
  }
  async function getJson(url, opts) {
    try {
      const r = await fetch(url, { cache: "no-store", ...opts });
      const ok = (r.headers.get("content-type") || "").includes("json");
      return { status: r.status, ok: r.ok && ok, data: ok ? await r.json() : null };
    } catch { return { status: 0, ok: false, data: null }; }
  }
  const authHeaders = () => ({ authorization: "Bearer " + password });

  /* ---------- state changes ---------- */
  const isDirty = () => JSON.stringify(state) !== snapshot;
  function refreshDirty() {
    const d = isDirty();
    const s = $("#save-state");
    s.textContent = d ? "Unsaved changes" : (updatedAt ? "Saved " + new Date(updatedAt).toLocaleString() : "All changes saved");
    s.classList.toggle("dirty", d);
    $("#save").disabled = mode === "live" ? !d : false;
  }
  let pvT;
  function pushPreview() {
    clearTimeout(pvT);
    pvT = setTimeout(() => {
      const f = $("#frame");
      if (f && f.contentWindow) f.contentWindow.postMessage({ type: "portfolio:preview", content: state }, location.origin);
    }, 120);
  }
  function changed(rerender) {
    refreshDirty(); pushPreview();
    if (rerender) renderTab();
  }

  /* ---------- field builders ---------- */
  function field(label, path, opt = {}) {
    const type = opt.type || "text";
    const val = getP(state, path);
    const set = (v) => { setP(state, path, v); if (opt.onSet) opt.onSet(v); changed(opt.rerender); };
    let input;
    if (type === "checkbox") {
      input = h("input", { type: "checkbox", onchange: (e) => set(e.target.checked) });
      input.checked = val !== false && val != null ? !!val : false;
      if (opt.defaultOn && val === undefined) input.checked = true;
      return h("label", { class: "check" + (opt.full ? " full" : "") }, input, label);
    }
    if (type === "textarea") {
      input = h("textarea", { rows: opt.rows || 4, placeholder: opt.placeholder, class: opt.cls, oninput: (e) => set(e.target.value) });
      input.value = val ?? "";
    } else if (type === "select") {
      input = h("select", { onchange: (e) => set(e.target.value) },
        (opt.options || []).map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h("option", { value: v }, l); }));
      input.value = val ?? "";
    } else if (type === "number") {
      input = h("input", { type: "number", min: opt.min, step: opt.step || 1, inputmode: "numeric", oninput: (e) => set(e.target.value === "" ? 0 : Number(e.target.value)) });
      input.value = val ?? 0;
    } else if (type === "color") {
      const txt = h("input", { type: "text", spellcheck: "false", maxlength: 7 });
      const pick = h("input", { type: "color", "aria-label": label });
      pick.value = /^#[\da-f]{6}$/i.test(val) ? val : "#000000"; txt.value = val ?? "";
      pick.addEventListener("input", () => { txt.value = pick.value; set(pick.value); });
      txt.addEventListener("input", () => { if (/^#[\da-f]{6}$/i.test(txt.value)) { pick.value = txt.value; set(txt.value); } });
      input = h("div", { class: "color-row" }, pick, txt);
    } else if (type === "range") {
      const out = h("output", {}, String(val ?? opt.min));
      const r = h("input", { type: "range", min: opt.min, max: opt.max, step: opt.step || 1, oninput: (e) => { out.textContent = e.target.value; set(Number(e.target.value)); } });
      r.value = val ?? opt.min;
      input = h("div", { class: "range-row" }, r, out);
    } else if (type === "icon") {
      input = h("div", { class: "icon-pick" }, ICONS.map((n) => h("button", {
        type: "button", title: n, "aria-label": n, class: n === val ? "on" : "", html: window.PixelIcons.svg(n, 26),
        onclick: (e) => { input.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); set(n); },
      })));
    } else {
      input = h("input", { type, placeholder: opt.placeholder, spellcheck: type === "url" ? "false" : null, oninput: (e) => set(e.target.value) });
      input.value = val ?? "";
    }
    return h(type === "icon" || type === "color" || type === "range" ? "div" : "label", { class: "fld" + (opt.full ? " full" : "") },
      h("span", {}, label), input, opt.help ? h("small", {}, opt.help) : null);
  }
  const group = (title, ...kids) => h("div", { class: "group" }, title ? h("h3", {}, title) : null, ...kids);
  const grid = (...kids) => h("div", { class: "grid2" }, ...kids);
  const hint = (html) => h("p", { class: "hint", html });

  function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; changed(true); }
  function tools(arr, i, { dup, name } = {}) {
    return h("div", { class: "item-tools" },
      h("button", { type: "button", class: "chip-btn", onclick: () => move(arr, i, -1), disabled: i === 0 }, "▲ Up"),
      h("button", { type: "button", class: "chip-btn", onclick: () => move(arr, i, 1), disabled: i === arr.length - 1 }, "▼ Down"),
      dup ? h("button", { type: "button", class: "chip-btn", onclick: () => { const c = clone(arr[i]); c.id = uid(); arr.splice(i + 1, 0, c); openItems.add(c.id); changed(true); } }, "Duplicate") : null,
      h("button", { type: "button", class: "chip-btn danger", onclick: () => { if (confirm(`Delete ${name || "this item"}?`)) { arr.splice(i, 1); changed(true); } } }, "Delete"));
  }
  function miniTools(arr, i) {
    return h("div", { class: "mini-tools" },
      h("button", { type: "button", class: "chip-btn", title: "Move up", "aria-label": "Move up", onclick: () => move(arr, i, -1), disabled: i === 0 }, "▲"),
      h("button", { type: "button", class: "chip-btn", title: "Move down", "aria-label": "Move down", onclick: () => move(arr, i, 1), disabled: i === arr.length - 1 }, "▼"),
      h("button", { type: "button", class: "chip-btn danger", title: "Delete", "aria-label": "Delete", onclick: () => { arr.splice(i, 1); changed(true); } }, "✕"));
  }
  function collapsible(id, summaryKids, bodyKids) {
    const d = h("details", { class: "item", open: openItems.has(id) },
      h("summary", {}, ...summaryKids), h("div", { class: "item-body" }, ...bodyKids));
    d.addEventListener("toggle", () => (d.open ? openItems.add(id) : openItems.delete(id)));
    return d;
  }

  /* ---------- tabs ---------- */
  const TABS = {
    profile: ["Profile", tabProfile],
    experience: ["Experience", tabExperience],
    categories: ["Categories", tabCategories],
    skills: ["Skills", tabSkills],
    stats: ["Stats", tabStats],
    layout: ["Sections & Text", tabLayout],
    theme: ["Theme", tabTheme],
    advanced: ["Backup & JSON", tabAdvanced],
  };

  function tabProfile() {
    return [
      h("h2", {}, "Profile"), hint("Everything at the top of your page, next to the beach."),
      group("Identity", grid(
        field("Display name", ["profile", "name"]),
        field("Tagline", ["profile", "tagline"], { full: true }))),
      group("Status", field("Show status line", ["profile", "showStatus"], { type: "checkbox" }), field("Status text", ["profile", "status"], { help: "Shown in a small box under your name." })),
      group("Discord", grid(
        field("Discord username", ["profile", "discordUsername"]),
        field("Discord user ID", ["profile", "discordId"], { help: "Used for the “Message on Discord” link." }))),
      group("Buttons", grid(
        field("Main button text", ["profile", "primaryButton"], { help: "Jumps to your first category." }),
        field("Discord button text", ["profile", "secondaryButton"]))),
      group("About section text", field("About me", ["about"], { type: "textarea", rows: 8, help: "Blank line = new paragraph. The first paragraph is shown bigger. Wrap words in **double stars** to highlight them." })),
    ];
  }

  function tabExperience() {
    const ex = state.experience || (state.experience = []);
    const cats = (state.categories || []).map((c) => [c.id, c.title]);
    const out = [h("h2", {}, "Experience"), hint("Each server role. <b>Current</b> roles show as shell cards; <b>past</b> roles sit in the egg nest. Members, IP and dates are optional and hidden when empty.")];
    ex.forEach((e, i) => {
      const sumText = h("span", { class: "sum-text" }, `${e.server || "New server"} — ${e.role || "Role"}`);
      const tag = h("span", { class: "sum-tag " + (e.status === "current" ? "current" : "") }, e.status === "current" ? "CURRENT" : "PAST");
      const upd = () => { sumText.textContent = `${e.server || "New server"} — ${e.role || "Role"}`; };
      out.push(collapsible(e.id, [sumText, tag], [
        grid(
          field("Server name", ["experience", i, "server"], { onSet: upd }),
          field("Server address / IP", ["experience", i, "address"], { help: "Visitors can tap it to copy." }),
          field("Your role", ["experience", i, "role"], { full: true, onSet: upd }),
          field("Members", ["experience", i, "members"], { type: "number", min: 0, help: "0 hides it." }),
          h("div", { class: "fld" }, h("span", {}, " "), field("Show “+” after number", ["experience", i, "membersPlus"], { type: "checkbox" })),
          field("Category", ["experience", i, "category"], { type: "select", options: cats }),
          field("Status", ["experience", i, "status"], { type: "select", options: [["current", "Current"], ["past", "Past"]], onSet: (v) => { tag.textContent = v === "current" ? "CURRENT" : "PAST"; tag.className = "sum-tag " + (v === "current" ? "current" : ""); } }),
          field("Note for past roles", ["experience", i, "note"], { placeholder: "Discontinued", help: "e.g. Discontinued, Resigned" }),
          field("Dates (optional)", ["experience", i, "period"], { placeholder: "Jan 2025 – Present" }),
          field("Description", ["experience", i, "description"], { type: "textarea", rows: 3, full: true }),
          field("Role icon", ["experience", i, "icon"], { type: "select", options: ROLE_ICONS, help: "Auto picks a crown for Owner, gear for Admin, shield for Mod and so on." }),
          field("Server logo URL (optional)", ["experience", i, "iconUrl"], { type: "url", placeholder: "https://…", help: "Replaces the icon on current-role cards." })),
        tools(ex, i, { dup: true, name: e.server || "this role" }),
      ]));
    });
    out.push(h("button", { type: "button", class: "mc-btn add-btn", onclick: () => {
      const n = { id: uid(), server: "New Server", address: "", role: "Role", members: 0, membersPlus: false, category: (state.categories || [])[0]?.id || "", status: "current", note: "", period: "", description: "", icon: "", iconUrl: "" };
      ex.push(n); openItems.add(n.id); changed(true);
    } }, "+ Add role"));
    return out;
  }

  function tabCategories() {
    const cats = state.categories || (state.categories = []);
    const out = [h("h2", {}, "Categories"), hint("Each category is its own section with a menu link. Roles are assigned in the Experience tab.")];
    cats.forEach((c, i) => {
      const count = (state.experience || []).filter((e) => e.category === c.id).length;
      const sumText = h("span", { class: "sum-text" }, c.title || "Untitled");
      out.push(collapsible("cat-" + c.id, [sumText, h("span", { class: "sum-tag" }, `${count} ROLES`)], [
        grid(
          field("Title", ["categories", i, "title"], { onSet: (v) => (sumText.textContent = v || "Untitled") }),
          field("Menu label", ["categories", i, "navLabel"], { help: "Shown in the menu at the top." }),
          field("Subtitle", ["categories", i, "subtitle"], { full: true }),
          field("Heading above current roles", ["categories", i, "currentTitle"]),
          field("Heading above the egg nest", ["categories", i, "pastTitle"])),
        field("Icon", ["categories", i, "icon"], { type: "icon" }),
        h("div", { class: "item-tools" },
          h("button", { type: "button", class: "chip-btn", onclick: () => move(cats, i, -1), disabled: i === 0 }, "▲ Up"),
          h("button", { type: "button", class: "chip-btn", onclick: () => move(cats, i, 1), disabled: i === cats.length - 1 }, "▼ Down"),
          h("button", { type: "button", class: "chip-btn danger", onclick: () => {
            if (cats.length === 1) return toast("Keep at least one category.");
            const other = cats.find((x) => x.id !== c.id);
            if (!confirm(count ? `Delete “${c.title}”? Its ${count} role(s) will move to “${other.title}”.` : `Delete “${c.title}”?`)) return;
            (state.experience || []).forEach((e) => { if (e.category === c.id) e.category = other.id; });
            cats.splice(i, 1); changed(true);
          } }, "Delete")),
      ]));
    });
    out.push(h("button", { type: "button", class: "mc-btn add-btn", onclick: () => {
      const n = { id: "cat-" + uid(), title: "New Category", navLabel: "New", subtitle: "", icon: "scute", currentTitle: "Right now", pastTitle: "Previous servers" };
      cats.push(n); openItems.add("cat-" + n.id); changed(true);
    } }, "+ Add category"));
    return out;
  }

  function tabSkills() {
    const sk = state.skills || (state.skills = []);
    const out = [h("h2", {}, "Skills"), hint("Each skill shows up to five scutes.")];
    sk.forEach((s, i) => {
      if (!s._id) Object.defineProperty(s, "_id", { value: uid(), enumerable: false });
      out.push(collapsible("sk-" + s._id, [h("span", { class: "sum-text" }, s.name || "Skill")], [
        field("Name", ["skills", i, "name"]),
        field("Scutes", ["skills", i, "level"], { type: "select", options: [["0", "No scutes"], ["1", "1 scute"], ["2", "2 scutes"], ["3", "3 scutes"], ["4", "4 scutes"], ["5", "5 scutes"]], onSet: (v) => (s.level = Number(v)) }),
        field("Description", ["skills", i, "desc"], { type: "textarea", rows: 2 }),
        field("Icon", ["skills", i, "icon"], { type: "icon" }),
        tools(sk, i, { name: s.name }),
      ]));
    });
    out.push(h("button", { type: "button", class: "mc-btn add-btn", onclick: () => { sk.push({ name: "New skill", desc: "", icon: "scute", level: 3 }); changed(true); } }, "+ Add skill"));
    return out;
  }

  function tabStats() {
    const st = state.stats || (state.stats = []);
    const out = [h("h2", {}, "Stats"), hint("Shown under your name, each with a small icon."),
      hint("Numbers can be typed in, or use auto-counters that update themselves: <code>{servers}</code> <code>{members}</code> <code>{current}</code> <code>{past}</code> <code>{roles:staff}</code>")];
    st.forEach((s, i) => out.push(h("div", { class: "row-item" },
      h("div", {}, grid(field("Value", ["stats", i, "value"]), field("Label", ["stats", i, "label"])), field("Icon", ["stats", i, "icon"], { type: "icon" })), miniTools(st, i))));
    if (st.length < 4) out.push(h("button", { type: "button", class: "mc-btn add-btn", onclick: () => { st.push({ label: "label", value: "0", icon: "egg" }); changed(true); } }, "+ Add stat"));
    else out.push(hint("Four is the limit. Remove one to add another."));
    return out;
  }

  function tabLayout() {
    const secs = state.sections || (state.sections = []);
    const out = [h("h2", {}, "Sections & Text"), hint("Show, hide and reorder sections. Sections with a menu label appear in the menu at the top.")];
    secs.forEach((s, i) => {
      const body = [h("div", { class: "sec-row" }, field(SECTION_NAMES[s.id] || s.id, ["sections", i, "visible"], { type: "checkbox" }), miniToolsNoDelete(secs, i))];
      if (["about", "skills", "contact"].includes(s.id)) {
        body.push(grid(
          field("Heading", ["sections", i, "title"]),
          field("Menu label", ["sections", i, "navLabel"], { help: "Empty = not in the menu." }),
          field("Subtitle", ["sections", i, "subtitle"], { full: true })));
        body.push(field("Icon", ["sections", i, "icon"], { type: "icon" }));
      } else if (s.id === "categories") body.push(hint("Titles and icons are in the Categories tab."));
      out.push(h("div", { class: "group" }, ...body));
    });
    const links = (state.contact = state.contact || {}).links || (state.contact.links = []);
    out.push(group("Contact section",
      field("Contact text", ["contact", "text"], { type: "textarea", rows: 3 }),
      h("p", { class: "hint" }, "Extra buttons (e.g. a server application form, YouTube, etc.):"),
      ...links.map((l, i) => h("div", { class: "row-item" }, h("div", {}, grid(field("Button label", ["contact", "links", i, "label"]), field("Link URL", ["contact", "links", i, "url"], { type: "url" }))), miniTools(links, i))),
      h("button", { type: "button", class: "chip-btn", onclick: () => { links.push({ label: "New link", url: "https://" }); changed(true); } }, "+ Add button")));
    out.push(group("Footer", field("Footer text", ["footer"], { type: "textarea", rows: 2 })));
    out.push(group("Search & sharing",
      field("Browser tab title", ["meta", "title"]),
      field("Description", ["meta", "description"], { type: "textarea", rows: 2, help: "Shown in Google results." })));
    return out;
  }
  function miniToolsNoDelete(arr, i) {
    return h("span", { style: "display:flex;gap:4px" },
      h("button", { type: "button", class: "chip-btn", "aria-label": "Move up", onclick: () => move(arr, i, -1), disabled: i === 0 }, "▲"),
      h("button", { type: "button", class: "chip-btn", "aria-label": "Move down", onclick: () => move(arr, i, 1), disabled: i === arr.length - 1 }, "▼"));
  }

  function tabTheme() {
    const t = ["theme"];
    return [
      h("h2", {}, "Theme"), hint("Sand, sea and turtle shell. Pick a preset or fine-tune each colour."),
      group("Presets", h("div", { class: "btn-row" }, Object.entries(PRESETS).map(([name, p]) =>
        h("button", { type: "button", class: "chip-btn preset", onclick: () => { Object.assign(state.theme, p); changed(true); toast(`${name} theme applied`); } },
          h("i", { style: `background:${p.shell}` }), h("i", { style: `background:${p.sea}` }), name)))),
      group("Beach", grid(
        field("Sand", [...t, "sand"], { type: "color" }),
        field("Wet sand (nest, specks)", [...t, "sandDark"], { type: "color" }),
        field("Sea", [...t, "sea"], { type: "color" }),
        field("Deep sea (footer)", [...t, "seaDeep"], { type: "color" }),
        field("Paper (cards)", [...t, "paper"], { type: "color" }),
        field("Eggs", [...t, "egg"], { type: "color" }))),
      group("Turtle", grid(
        field("Shell (name, buttons)", [...t, "shell"], { type: "color" }),
        field("Scutes", [...t, "scute"], { type: "color" }),
        field("Turtle green (highlights)", [...t, "turtle"], { type: "color" }),
        field("Wood (cork)", [...t, "wood"], { type: "color" }))),
      group("Text", grid(
        field("Text & outlines", [...t, "ink"], { type: "color" }),
        field("Soft text", [...t, "muted"], { type: "color" }))),
      group("Font", grid(
        field("Heading font", [...t, "headingFont"], { type: "select", options: FONTS }),
        field("Body font", [...t, "bodyFont"], { type: "select", options: FONTS })),
        field("Body text size", [...t, "bodySize"], { type: "range", min: 13, max: 22 })),
      group("Effects",
        field("Sand texture on the background", [...t, "texture"], { type: "checkbox" }),
        field("Turtle that walks along the bottom as you scroll", [...t, "walker"], { type: "checkbox" })),
    ];
  }

  function tabAdvanced() {
    const box = h("textarea", { class: "json-box", spellcheck: "false", rows: 16 });
    box.value = JSON.stringify(state, null, 2);
    const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { state = merge(clone(base), JSON.parse(await f.text())); changed(true); toast("Imported — press Save to publish."); }
      catch { toast("That file isn't valid JSON."); }
    } });
    return [
      h("h2", {}, "Backup & JSON"),
      group("Backup",
        hint(mode === "live" ? "Every save keeps the previous version, so you can undo one save." : "Live saving is off on this deploy — download content.json and replace the file in your project."),
        h("div", { class: "btn-row" },
          h("button", { type: "button", class: "chip-btn", onclick: download }, "Download content.json"),
          h("button", { type: "button", class: "chip-btn", onclick: () => fileIn.click() }, "Import JSON file"),
          mode === "live" ? h("button", { type: "button", class: "chip-btn", onclick: restorePrevious }, "Load previous save") : null,
          h("button", { type: "button", class: "chip-btn danger", onclick: () => { if (confirm("Reset everything to the original content? (Not saved until you press Save.)")) { state = clone(base); changed(true); } } }, "Reset to defaults")),
        fileIn),
      group("Raw JSON",
        hint("Edit anything directly, then press Apply. Useful for bulk changes."),
        h("label", { class: "fld" }, box),
        h("button", { type: "button", class: "mc-btn small", onclick: () => {
          try { state = JSON.parse(box.value); changed(true); toast("JSON applied."); }
          catch (err) { toast("Invalid JSON: " + err.message); }
        } }, "Apply JSON")),
    ];
  }

  function renderTabs() {
    const nav = $("#tabs"); nav.innerHTML = "";
    for (const [id, [label]] of Object.entries(TABS)) {
      nav.append(h("button", { type: "button", role: "tab", "aria-selected": String(id === tab), onclick: () => { tab = id; renderTabs(); renderTab(); $("#panel").scrollTop = 0; } }, label));
    }
  }
  function renderTab() {
    const panel = $("#panel"); const y = panel.scrollTop;
    panel.innerHTML = "";
    panel.append(...TABS[tab][1]());
    panel.scrollTop = y;
  }

  /* ---------- save / load ---------- */
  function download() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "content.json" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function save() {
    if (mode !== "live") { download(); toast("Downloaded content.json — replace public/content.json and redeploy."); return; }
    const btn = $("#save"); btn.disabled = true; btn.textContent = "Saving…";
    const r = await getJson(API, { method: "PUT", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ content: state }) });
    btn.textContent = "Save";
    if (r.status === 401) { toast("Session expired — log in again."); logout(); return; }
    if (!r.ok) { toast("Save failed: " + ((r.data && r.data.error) || "network error")); refreshDirty(); return; }
    snapshot = JSON.stringify(state); updatedAt = r.data.updatedAt;
    refreshDirty(); toast("Saved! Your portfolio is updated.");
  }
  async function restorePrevious() {
    const r = await getJson(API + "?backup=1", { headers: authHeaders() });
    if (!r.ok || !r.data || !r.data.content) return toast("No previous save found yet.");
    if (!confirm(`Load the version saved ${new Date(r.data.updatedAt).toLocaleString()}? Press Save afterwards to publish it.`)) return;
    state = merge(clone(base), r.data.content); changed(true);
  }
  function logout() {
    try { sessionStorage.removeItem(PW_KEY); } catch {}
    password = ""; $("#dash").hidden = true; $("#login").hidden = false; $("#pw").value = ""; $("#pw").focus();
  }
  async function verify(pw) {
    const r = await getJson(API + "?action=login", { method: "POST", headers: { authorization: "Bearer " + pw } });
    return r;
  }

  function enter() {
    $("#login").hidden = true; $("#dash").hidden = false;
    const pill = $("#mode-pill");
    if (mode === "offline") {
      pill.textContent = "Offline"; pill.classList.add("offline");
      const b = $("#offline-banner"); b.hidden = false;
      b.textContent = "Live saving isn't available on this deploy (the Netlify Function isn't running). You can still edit — “Save” downloads content.json for you to upload. See the README to turn on live saving.";
      $("#save").textContent = "Download"; $("#logout").hidden = true;
    }
    renderTabs(); renderTab(); refreshDirty();
  }

  function wire() {
    $(".login-card .slot").innerHTML = window.PixelIcons.svg("turtle", 40);
    $("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = $("#pw").value, err = $("#login-err"), btn = $("#login-btn");
      btn.disabled = true; btn.textContent = "Checking…"; err.textContent = "";
      const r = await verify(pw);
      btn.disabled = false; btn.textContent = "Log in";
      if (r.ok) { password = pw; try { sessionStorage.setItem(PW_KEY, pw); } catch {} enter(); }
      else err.textContent = (r.data && r.data.error) || "Couldn't reach the server.";
    });
    $("#save").addEventListener("click", save);
    $("#logout").addEventListener("click", () => { if (!isDirty() || confirm("You have unsaved changes. Log out anyway?")) logout(); });
    $("#preview-open").addEventListener("click", () => { $("#preview").classList.add("open"); pushPreview(); });
    $("#preview-close").addEventListener("click", () => $("#preview").classList.remove("open"));
    document.querySelectorAll("[data-device]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("[data-device]").forEach((x) => x.classList.toggle("on", x === b));
      $("#frame-wrap").classList.toggle("mobile", b.dataset.device === "mobile");
    }));
    window.addEventListener("message", (e) => { if (e.origin === location.origin && e.data && e.data.type === "portfolio:ready") pushPreview(); });
    window.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!$("#dash").hidden) save(); } });
    window.addEventListener("beforeunload", (e) => { if (!$("#dash").hidden && isDirty()) { e.preventDefault(); e.returnValue = ""; } });
  }

  async function init() {
    wire();
    const b = await getJson("content.json");
    base = b.data || {};
    const live = await getJson(API);
    mode = live.ok ? "live" : "offline";
    if (live.ok && live.data) updatedAt = live.data.updatedAt;
    state = merge(clone(base), live.ok && live.data ? live.data.content : null);
    state.experience = (state.experience || []).map((e) => (e.id ? e : { ...e, id: uid() }));
    snapshot = JSON.stringify(state);
    $("#booting").remove();

    if (mode === "live") {
      let saved = ""; try { saved = sessionStorage.getItem(PW_KEY) || ""; } catch {}
      if (saved && (await verify(saved)).ok) { password = saved; enter(); }
      else { $("#login").hidden = false; $("#pw").focus(); }
    } else enter();
  }
  init();
})();
