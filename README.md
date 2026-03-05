# WWM GvG Strategy

WWM GvG Strategy is a desktop app for planning guild-vs-guild battle strategy. It includes a drag-and-drop roster and a battle map with markers and drawing tools.

## Features

- Drag-and-drop player placement on the battle map
- Team grouping, role filters, and search
- Objective, boss, tower, tree, and goose markers
- Drawing tools with undo/redo and optional auto-delete
- Export/import strategy data

## Requirements

- Node.js (LTS recommended)
- npm

## Install

```bash
npm install
```

## Run (Development)

```bash
npm run dev
```

This runs the Electron app with hot reload enabled for local changes.

Note: hot reload is now opt-in to avoid crashes when packaged output folders exist in the repo.

- Normal dev run (recommended):
	- `npm run dev`
- Optional hot reload run (PowerShell):
	- `$env:ELECTRON_HOT_RELOAD='1'; npm run dev`

## Build (Windows Installer)

```bash
npm run build
```

The installer will be created in the `dist/` folder.

## Deploy on Render (No API / No Database)

This project can be deployed as a static site on Render without adding a backend API or database.

### Prerequisite (one-time): configure `guildwar.config.js`

Before deploying, edit `guildwar.config.js`:

```js
window.GUILD_WAR_CONFIG = {
	discordClientId: 'YOUR_DISCORD_CLIENT_ID',
	discordRedirectUri: 'https://your-app-name.onrender.com/',
	appBaseUrl: 'https://your-app-name.onrender.com/',
	deployment: 'cloud'
};
```

You can copy values from `guildwar.config.example.js`.

### 1) Render setup

- Create a new **Static Site** on Render and connect this repository.
- Use:
	- **Build Command:** *(leave empty)*
	- **Publish Directory:** `.`
- A ready blueprint file is included: `render.yaml`.

### 2) Discord OAuth2 setup (required for Guild War member login)

1. Open Discord Developer Portal: `https://discord.com/developers/applications`
2. Create/select your app.
3. Copy **Client ID**.
4. Open **OAuth2** → **Redirects**.
5. Add redirect URI exactly as your deployed URL, for example:
	- `https://your-app-name.onrender.com/`
6. Save changes in Discord portal.
7. Put that Client ID + Redirect URI into `guildwar.config.js`.
8. Commit and push again so Render redeploys.

### 3) Data behavior on hosted site

- App data is stored in browser `localStorage`.
- Data is per-user and per-browser.
- Data is not automatically shared across users.

### 4) Sync approach (without database)

- Use Export/Import JSON in the app to move strategy data between users/devices.

### 5) First run checklist (cloud)

1. Open your Render URL.
2. Go to **Guild War** tab.
3. Click **Login with Discord**.
4. Submit a member registration.
5. Go to **Guild War Admin** tab to generate teams and manage attendance.

### 6) Discord webhook safety note

- If a webhook URL is entered client-side, it can be exposed to users in the browser.
- For public/shared use, prefer copy-and-paste posting or add a small secure server proxy later.

## Project Scripts

- `npm run dev` - Run the Electron app in development.
- `npm run build` - Build the Windows installer.

## Notes

If you update the code, you must rebuild and reinstall the packaged app for those changes to appear in the installed version.
