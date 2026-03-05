# Guild War Registration (Standalone Deploy)

This folder is a standalone static project for deploying only Guild War registration pages.

## Files

- `guild-war-user.html`
- `guild-war-admin.html`
- `guildwar.js`
- `guildwar.config.js`
- `styles-fixed.css`

## Configure

Edit `guildwar.config.js` before deploy:

- `discordClientId`
- `discordRedirectUri`
- `appBaseUrl`
- `memberAppUrl`
- `adminAppUrl`
- `registrationApiUrl` (optional)
- `firebaseDatabaseUrl` (optional, for Realtime Database sync)
- `firebaseRegistrationsPath`

## Firebase Hosting Deploy (this folder only)

Run from this folder:

```powershell
firebase deploy --only hosting
```

This deploy uploads only files in `guild-war-registration/`, not the whole root project.
