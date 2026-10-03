# VS Code Mobile

A touch-friendly, open-source coding workspace for Android-sized screens and the web. This is an independent community project, not an official Microsoft or Visual Studio Code product.

## What works now

- Monaco Editor, the editor engine also used by VS Code, with syntax highlighting, bracket matching, suggestions, multiple tabs, and editor shortcuts.
- A real terminal rendered by xterm.js and connected to a local PTY process through WebSockets.
- File explorer with create, read, edit, save, delete, and refresh operations against real files on disk.
- JavaScript execution through Node.js from the terminal and HTML preview.
- Responsive layout for narrow screens and desktop browsers.

## Run locally

Requires Node.js 20+ and a working native build toolchain for node-pty if a prebuilt binary is not available.

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Open the Vite URL printed in the terminal, normally `http://localhost:5173`.

The backend creates a `workspace/` folder in the repository. To edit a different local project, set `WORKSPACE_DIR` in `.env` to its absolute path. Restart the backend after changing environment settings.

## Important security boundary

**The terminal is a real shell running with the current operating-system user's permissions.** The backend binds to `127.0.0.1` by default and checks browser origins and a per-process session token. Do not change the host to `0.0.0.0`, expose this backend to the public internet, or use it as a multi-user cloud service. Origin checks and a session token are not a substitute for OS/container isolation.

A hosted version needs per-user authentication, isolated ephemeral containers or VMs, CPU/memory/time limits, storage quotas, network egress policy, secret management, audit logging, and security review. The current backend is intended for trusted local development only.

## Android and web

The responsive UI runs in a mobile browser. A proper installable Android app can be added with Capacitor, but a mobile app still needs a reachable workspace backend to provide a real terminal. Android's app sandbox does not automatically provide a Linux development shell.

## About VS Code source

The project currently uses the separately published Monaco Editor and xterm.js libraries rather than copying the entire VS Code desktop application. This keeps the web app smaller and makes mobile adaptation practical. The Visual Studio Code source distribution is available under Microsoft's source repository and license terms; the VS Code product name, marketplace access, and Microsoft branding have separate restrictions. This project is independent and unaffiliated.

## Roadmap

1. Add project import/export and Git operations in the UI.
2. Add automated tests for file API path validation, saves, and terminal lifecycle.
3. Add Capacitor Android packaging and test on real devices.
4. Design a hardened isolated backend before offering remote/cloud terminals.
5. Add accessible keyboard/touch controls and mobile editor ergonomics.

## Contributing

Issues and pull requests are welcome. Include your OS, Node.js version, device/browser, and reproduction steps.

## License

MIT. See [LICENSE](LICENSE).
