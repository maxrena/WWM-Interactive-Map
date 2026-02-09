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
npm run electron
```

This runs the Electron app with hot reload enabled for local changes.

## Build (Windows Installer)

```bash
npm run electron:dist
```

The installer will be created in the `dist/` folder.

## Project Scripts

- `npm run electron` - Run the Electron app in development.
- `npm run electron:dist` - Build the Windows installer.

## Notes

If you update the code, you must rebuild and reinstall the packaged app for those changes to appear in the installed version.
