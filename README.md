# 3vhy — Minecraft Staff Portfolio

A pixel-art staff portfolio with a Minecraft turtle beach theme: sand, sea, turtle eggs and a turtle that walks along the bottom as you scroll.
It has a password-protected **live dashboard** at `/dashboard`.
Edits made in the dashboard save straight to your Netlify site — no re-uploading files.

```
public/
  index.html          ← the portfolio
  dashboard.html      ← the editor  (yoursite.netlify.app/dashboard)
  content.json        ← default content (used until you first save from the dashboard)
  assets/             ← styles + scripts
netlify/functions/
  content.mjs         ← saves/loads content with Netlify Blobs
netlify.toml          ← tells Netlify where everything is
package.json
```

---

## Deploy on Netlify (with live saving)

> ⚠️ **Don't use drag-and-drop for this.** Drag-and-drop only uploads static files, so the
> save function won't run and the dashboard falls back to "Offline" mode. Use GitHub (easiest)
> or the Netlify CLI.

### Option A — GitHub (recommended, works from a phone too)

1. Create a new repository on GitHub (e.g. `3vhy-portfolio`).
2. Upload **everything in this folder** to it (keep the folder structure — `public/`,
   `netlify/`, `netlify.toml`, `package.json`). On github.com: *Add file → Upload files*,
   then drag the contents in.
3. In Netlify: **Add new project → Import an existing project → GitHub** → pick the repo.
   Netlify reads `netlify.toml` automatically — leave the build settings as they are and deploy.
4. Set your dashboard password: **Project configuration → Environment variables → Add a variable**
   - Key: `ADMIN_PASSWORD`
   - Value: a long password only you know
5. Go to **Deploys → Trigger deploy → Deploy project** so the password takes effect.
6. Open `https://<your-site>.netlify.app/dashboard`, log in, edit, press **Save**. Done —
   the public page updates instantly.

Every time you push to GitHub, Netlify redeploys automatically. Your dashboard edits are stored
separately (in Netlify Blobs), so redeploying never wipes them.

### Option B — Netlify CLI

```bash
npm install
npx netlify-cli login
npx netlify-cli init            # create/link a site
npx netlify-cli env:set ADMIN_PASSWORD "your-long-password"
npx netlify-cli deploy --prod
```

---

## Using the dashboard

| Tab | What you can change |
| --- | --- |
| **Profile** | Name, tagline, status line, Discord username + ID, button text, About text |
| **Experience** | Add / edit / reorder / delete roles: server, role, current or past, note (e.g. *Discontinued*), IP, members, dates, description, role icon. Current roles show as shell cards, past roles sit in the egg nest |
| **Categories** | The Staff section's title, subtitle, menu label and icon, and the headings above the cards and the nest. You can add more categories |
| **Skills** | Skills with 0 to 5 scutes |
| **Stats** | Up to 4 numbers under your name, each with an icon. Auto-counters: `{servers}` `{current}` `{past}` `{members}` `{roles:staff}` |
| **Sections & Text** | Show/hide/reorder sections, headings, menu labels and icons, contact text + extra buttons, footer, browser tab title, Google description |
| **Theme** | Presets (Beach, Lagoon, Sunset, Mangrove), every colour, fonts (Pixelify Sans and Monocraft built in), text size, sand texture, walking turtle on/off |
| **Backup & JSON** | Download/import a backup, undo the last save, reset to defaults, raw JSON editing |

- The preview on the right updates as you type. On a phone, tap **Preview**.
- **Ctrl/Cmd + S** saves.
- Every save keeps the previous version — *Backup & JSON → Load previous save* to undo.
- In About text: blank line = new paragraph, `**word**` = highlighted.

## Notes

- **Changing the password:** edit `ADMIN_PASSWORD` in Netlify and redeploy.
- **Forgot to set the password?** The login screen tells you `ADMIN_PASSWORD isn't set`.
- **Without the function** (e.g. drag-and-drop): the dashboard still works in *Offline* mode —
  "Save" downloads `content.json`; replace `public/content.json` with it and redeploy.
- Test locally with `npx netlify-cli dev` (uses a local sandbox store, not your live data).
- Fonts: [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) by the Pixelify Sans Project Authors and [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan, both SIL Open Font License (licences in `public/assets/fonts/`).
