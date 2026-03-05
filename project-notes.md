# Project Notes (WWM Interactive Map / WWM - Super App)

Last reviewed: 2026-03-04

## 1) What this project is

Electron desktop app for guild-vs-guild strategy planning with 4 tabs:

1. **Map**: drag/drop players and team groups onto a battle map, place objectives/boss/towers/trees/geese, draw tactical lines.
2. **Roster**: load and view Google Sheet roster data.
3. **Guild War**: registration, role-balanced team generation, Discord webhook posting, attendance reliability tracking.
4. **Gacha**: track 5-slot pull colors/counters and history.

---

## 2) Stack and runtime model

- **Desktop shell**: Electron
- **UI**: Plain HTML/CSS/Vanilla JS (no framework)
- **Renderer architecture**: one large controller file + one gacha module
- **Persistence**: `localStorage` + JSON export/import files
- **Offline support**: service worker cache + web manifest

### Entry points

- `main.js`:
  - Creates BrowserWindow
  - Loads `index.html`
  - Exposes app version over IPC (`app-version`)
  - Uses `electron-reload` in dev mode
- `preload.js`:
  - Exposes `window.appInfo.version()` via contextBridge
- `index.html`:
  - Loads `styles-fixed.css`
  - Defines all 4 tabs and modals
  - Loads scripts in this order:
    1. `data.js`
    2. `app.js`
    3. `guildwar.js`
    4. `gacha.js`
  - Registers `sw.js`

---

## 3) File map (important files only)

- `app.js` (large, ~4.4k lines):
  - Main map logic, roster loading, theme toggle, player CRUD, strategy import/export, drawing/canvas.
- `gacha.js`:
  - `GachaTracker` class + gacha history import/export.
- `guildwar.js`:
  - Guild War registration, attendance/reliability, auto team generation, Discord webhook posting.
- `data.js`:
  - Default seed of 30 players (`members`).
- `styles-fixed.css`:
  - Active stylesheet used by `index.html`.
- `styles.css`:
  - Appears unused by current app shell.
- `sw.js`:
  - Cache-first service worker for static assets.
- `manifest.json`:
  - PWA metadata.

---

## 4) App initialization sequence

`init()` in `app.js` performs startup in this order:

1. Load players from storage (`vcross-gvg-players`) or seed defaults.
2. Load custom team names, collapse states, and team colors.
3. Load theme preference.
4. Render member list.
5. Wire map and UI event listeners.
6. Setup tabs + roster handlers.
7. Load saved map placements.
8. Update counts.
9. Initialize drawing canvas.
10. Setup click-outside and player management modal handlers.

---

## 5) Core feature behavior

### A) Map tab

- Supports drag/drop placement of:
  - Individual players
  - Team group markers (with merge/split behavior)
  - Objective/Boss/Blue+Red Tower/Blue+Red Tree/Blue+Red Goose markers
  - Enemy groups (5 enemies per click, up to max)
- Drawing system:
  - Freehand canvas drawing
  - Color picker
  - Undo/redo stacks
  - Optional auto-delete after 10 seconds
- Keyboard shortcuts include:
  - `O`, `B`, `1`..`6`, `D`, `Esc`, `Ctrl+Z`, `Ctrl+Y`, `Shift+?`

### B) Roster tab

- Takes Google Sheet link and extracts sheet ID.
- Calls Google Sheets API (`values/A1:Z1000`) and renders table.
- Uses hardcoded API key in `app.js` (`GOOGLE_SHEETS_API_KEY`).

### C) Gacha tab

- 5 slots (`Slot1..Slot5`) with color selection (White/Purple/Gold).
- Each slot has independent counter.
- Confirm pull:
  - Stores pull record timestamp/colors/counters.
  - Increments totals.
  - Resets slot counter(s) where selected color is Gold.
- History supports export/import/clear.

### D) Guild War tab

- Registration fields: Discord name, character name, role, power, time slots, backup/can-sub flags.
- Auto team generation with configurable composition (team size + tanks/healers/dps per team).
- Priority score:
  - `priority = power * 0.6 + reliability * 0.4 - backup_penalty`
- Attendance snapshots by event date.
- Reliability summary from attendance history.
- Discord-ready team message copy + optional webhook posting.

---

## 6) Persistence contracts

### localStorage keys used by `app.js`

- `vcross-gvg-players` -> full player list
- `vcross-gvg-positions` -> map placements (members/groups/markers/enemies)
- `vcross-gvg-team-names` -> custom team display names
- `vcross-gvg-team-collapse-states` -> roster panel group collapse flags
- `vcross-gvg-team-colors` -> team color overrides
- `vcross-gvg-theme` -> `dark` or `light`

### localStorage keys used by `gacha.js`

- `gacha_pull_history` -> array of pull records

### localStorage keys used by `guildwar.js`

- `wwm-guild-war-data-v1` -> registrations, generated teams, attendance events, webhook URL

### Strategy export/import JSON (`app.js`)

Current export includes:

- metadata: `version`, `exportDate`
- `players`
- placements: `individuals`, `groups`
- markers: `objectives`, `bosses`, `blueTowers`, `redTowers`, `blueTrees`, `redTrees`, `blueGeese`, `redGeese`
- `enemies`
- `drawings`
- `teamNames`

Import supports backward compatibility for old single arrays (`towers`, `trees`) and old team naming migrations.

---

## 7) Data migration behavior already present

- Old team labels migrate to new `Team 1..Team 6` naming.
- Old `Support` role migrates to `DPS`.
- Old storage/export formats for towers/trees are still accepted.

---

## 8) Build/run commands

From `package.json`:

- `npm run dev` -> launches Electron app
- `npm run build` -> creates Windows installer via electron-builder

Build output directories commonly seen:

- `dist/`
- `dist-new/`

---

## 9) Known technical debt / risk hotspots

1. **Monolithic `app.js`**
   - Contains many responsibilities; hard to reason about safely.
2. **Hardcoded Google API key**
   - Should ideally be moved out of source (env/config) for safer handling.
3. **Extensive inline DOM/event logic**
   - High coupling between rendering, state, and event handlers.
4. **Mixed desktop + PWA patterns**
   - Service worker/manifest exist even though primary runtime is Electron.

---

## 10) Suggested future refactor boundaries

If refactoring, split `app.js` by concern:

1. `state/` (map state, team state, storage adapters)
2. `map/markers/` (each marker type handler)
3. `map/groups/` (group merge/split/drag)
4. `drawing/` (canvas + history + auto-delete)
5. `players/` (CRUD modal + validation)
6. `roster/` (Google Sheets fetch + table rendering)
7. `ui/` (tabs, theme, modals, keyboard shortcuts)

---

## 11) Fast re-onboarding checklist (next session)

1. Read this file.
2. Confirm script order in `index.html`.
3. Check `init()` in `app.js` for startup side effects.
4. Validate `localStorage` keys before changing data models.
5. For map behavior changes, inspect:
   - drag/drop handlers
   - `renderMap()`
   - import/export + save/load paths
6. For gacha changes, focus on `GachaTracker` in `gacha.js`.

---

## 12) Reminder for release verification

After code changes intended for installed app users:

1. Run `npm run build`
2. Reinstall/update built app
3. Verify behavior in packaged app (not only dev mode)

---

## 13) External planning context (from shared ChatGPT discussion)

Source reviewed: `https://chatgpt.com/share/69a8e9be-9c5c-8002-8533-ae78e436ca05`

### High-level recommendation from that discussion

- Evolve guild-war operations in 3 levels:
  1. Better Google Form + Google Sheets structure (no code)
  2. Google Apps Script automation + Discord webhook posting
  3. Custom app (web dashboard and/or Discord bot)
- Preferred long-term direction: **Discord Bot + lightweight web dashboard** for officer control.

### Suggested data fields for guild-war registration

- Discord name
- Role/class
- Power level
- Available time slots
- Backup/main flag
- Last-minute substitution availability

### Suggested process improvements

- Role-balanced auto team generation (for example, 1 Tank / 1 Healer / 3 DPS).
- Attendance tracking with reliability score:
  - `reliability = showed_up / registered`
- Priority score example:
  - `priority = power * 0.6 + reliability * 0.4`
- Auto reserve promotion when cancellations occur.
- Auto post finalized teams to Discord.

### Suggested stack from that discussion (if moving to web app)

- Frontend: React
- Backend: Node.js + Express
- Database: PostgreSQL (or Supabase as a simpler managed option)
- Integration: Discord OAuth + webhook/bot posting
- Hosting: low-cost VPS or Lightsail class setup

### What this means for the current Electron project

- Current app already covers a strong **manual strategy board** (map + roster view + export/import).
- Missing pieces for the recommended workflow are:
  - registration intake pipeline
  - attendance/reliability storage
  - role-balance auto team builder algorithm
  - Discord automation (webhook/bot)
- If this codebase continues as primary tool, best next phase is to add:
  1. structured player metrics (availability, reliability, power)
  2. auto-assignment engine
  3. Discord posting integration

### Practical roadmap fit

1. Keep Electron app for tactical map planning and officer adjustments.
2. Add/import richer roster attributes (role/power/availability/reliability).
3. Implement auto-team generation as a deterministic service/module.
4. Add one-click export to Discord format (and optional webhook send).
5. Add attendance capture after event to continuously improve future team quality.
