# VS Code Mobile

A touch-friendly coding workspace for Android-sized screens and the web. This is an independent community project, not an official Microsoft or Visual Studio Code product.

## Features

- Monaco Editor with syntax highlighting, suggestions, multiple tabs, and editor shortcuts.
- xterm.js terminal connected to a real PTY shell through WebSockets.
- File explorer with create, read, edit, save, delete, and refresh operations on the workspace filesystem.
- JavaScript execution through Node.js and sandboxed HTML preview.
- Responsive desktop/mobile layout.
- Capacitor Android wrapper and GitHub Actions workflow that builds an installable debug APK.

## Run the real workspace locally

Requires Node.js 20+ and a native build toolchain for `node-pty` if a prebuilt binary is unavailable.

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env`. Open the Vite URL printed in the terminal, normally `http://localhost:5173`. The backend creates a `workspace/` folder. Set `WORKSPACE_DIR` in `.env` to edit a different local project.

## Build the Android app

Install Android Studio and its Android SDK, then run:

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

In Android Studio, build and install the app on a connected device or emulator. The native project is generated in `android/` and is not required for the web-only build.

A debug APK is also built automatically by the **Build Android APK** workflow after relevant changes are pushed to `main`. Open the repository's Actions tab, select the successful workflow run, and download the `vs-code-mobile-debug-apk` artifact. It is a debug build for testing, not a Play Store-signed release.

## Run code locally with Termux (Android)

The Android APK includes a native Termux bridge for running the current JavaScript, Python, or shell file directly on the phone. This does not require the PC workspace backend for the **Run** action.

1. Install Termux from the official [Termux GitHub releases](https://github.com/termux/termux-app/releases) or F-Droid. Avoid mixing Termux and its add-ons from different signing sources.
2. Open Termux and run:
   ```sh
   pkg update
   pkg install nodejs python
   ```
   Install any other language runtimes you need with `pkg`.
3. In Termux, create or edit `~/.termux/termux.properties` and set:
   ```
   allow-external-apps = true
   ```
   Then fully stop and reopen Termux. Only enable this for apps you trust.
4. Install a newly built VS Code Mobile APK. Open a `.js`, `.py`, or `.sh` file and tap **Run in Termux**. The app sends the current editor contents to `~/VSCodeMobile/` in Termux and opens a Termux session to execute it.

The Termux bridge runs code in Termux's own terminal window; it does not stream terminal output back into the embedded xterm panel. File create/read/edit/save/delete now work in local mode without a backend, and changes persist in the app's WebView storage. The current Run action sends the active editor contents to a file in `~/VSCodeMobile/` in Termux. This is a copy for execution, not a shared folder: edits made directly in Termux do not automatically sync back into the editor.

## Connecting the Android app to a workspace backend

The optional workspace backend provides a shared filesystem, embedded interactive terminal, and HTML preview. Without it, the editor automatically falls back to a local workspace saved in browser/app storage; this mode supports file create/read/edit/save/delete but does not provide an embedded shell. To build the web bundle against a backend URL, set `VITE_WORKSPACE_API_URL` before building, for example:

```bash
VITE_WORKSPACE_API_URL=https://your-workspace-host.example npm run build
```

Use the same environment variable when building the APK so its frontend connects to that backend. The value is the backend origin only (no `/api` suffix). For Windows PowerShell, use `$env:VITE_WORKSPACE_API_URL="https://your-workspace-host.example"` before the build.

**Important:** the included backend is a trusted, single-user local development backend, not a safe public cloud service. It launches a shell with the server OS user's permissions, and its current session token is shared by that backend process. Do not expose it directly to the internet or put it behind a public URL for multiple users. A genuinely hosted multi-user workspace requires per-user authentication and isolated containers/VMs with resource limits, storage quotas, network policy, and secret management. Until that hardened service exists and is deployed, the APK packaging is real, but remote multi-user terminal service is not provided out of the box.

For a local Android device, the backend host must be reachable from the phone over the same network and configured to allow the app's `https://localhost` origin. Configure `WORKSPACE_HOST`, `WORKSPACE_PORT`, `WORKSPACE_DIR`, and `WORKSPACE_ORIGINS` in the backend's `.env`; do not bind to a public interface unless you have separately secured the service. Note that Android's `localhost` refers to the phone itself, not your PC.

## Web deployment

A static Vercel deployment can serve the editor UI and local-first file editor, but Vercel static hosting does not run this Node.js PTY backend. In static mode, files are saved in that browser's local storage and are not automatically synced across browsers/devices. Set `VITE_WORKSPACE_API_URL` only to a separately hosted, secured backend if you need a shared filesystem and embedded terminal.

## Project scope and branding

This project uses the separately published Monaco Editor and xterm.js libraries rather than copying the full VS Code desktop application. It is an independent project and is not affiliated with Microsoft. VS Code product branding and Marketplace access have separate restrictions.

## Contributing and license

Issues and pull requests are welcome. Include your OS, Node.js version, device/browser, and reproduction steps. Licensed under MIT; see [LICENSE](LICENSE).
