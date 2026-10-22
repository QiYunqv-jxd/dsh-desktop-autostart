# dsh-desktop-autostart

Logon autostart for the **DeepSeek Harness desktop app** on Windows.

Every other "autostart" plugin for DSH starts a `dsh web` server in the background, or ships its own tray/desktop shell. This one does the opposite: it registers the **official desktop app itself**, so the window you actually use is there after you log in — and nothing else is started.

## Why this exists

- The desktop build has no built-in "launch at login" (the Electron shell does not call `setLoginItemSettings`).
- Adding a `dsh web` service on top of a desktop app means two processes, two ports, and two places to look.
- A Startup-folder shortcut is the smallest possible mechanism: single instance, no daemon, no service, no extra port.

## Features (v0.1 preview)

- Enable / disable logon autostart from the plugin.
- Points the entry at the **currently running desktop executable**, resolved at enable time.
- Self-check: reports whether the entry exists, whether its target still matches, and whether duplicates are present.
- Repair path: re-creates a stale or broken entry instead of stacking new ones.
- Clean uninstall: removes the entry when the plugin is disabled or removed.

Windows only.

## How it works

1. Resolve the desktop executable path (or an explicit `DSH_DESKTOP_EXE` override).
2. Create or remove a `.lnk` in the per-user Startup folder
   (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`)
   through `WScript.Shell` COM, from a small PowerShell helper.
3. Verify by reading the shortcut back and comparing the target.

No registry writes, no scheduled tasks, no elevation.

## Install

```bash
dsh plugin add github:QiYunqv-jxd/dsh-desktop-autostart
```

## Status

Early preview (v0.1.0). The autostart engine (`lib/autostart-win.js`) is implemented and self-tested on Windows; the settings surface is being wired up.

## License

MIT. Not affiliated with DeepSeek.
