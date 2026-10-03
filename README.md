# VS Code Mobile

A touch-friendly, open-source coding workspace for Android-sized screens and the web.

> **Project status: early prototype.** This is an independent community project and is not affiliated with, endorsed by, or an official product of Microsoft or the Visual Studio Code team.

## Current prototype

- Responsive dark IDE-style layout for desktop and mobile browsers
- Editable starter files with local browser persistence
- File explorer, filename filtering, tabs, line numbers, and basic JavaScript syntax colors
- Run JavaScript in an isolated sandboxed iframe and view console output
- HTML preview in a sandboxed iframe
- Demo terminal with `help`, `ls`, `pwd`, `cat <file>`, `echo <text>`, and `clear`
- GitHub repository shortcut and a basic source-control placeholder
- GitHub Actions workflow to build the web app on pushes and pull requests

**Important:** The terminal is currently simulated. It does not provide a real shell, Node.js, Python, package installation, or access to the host device. The editor stores files in the current browser's local storage; it does not yet sync with GitHub.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To make a production build:

```bash
npm run build
npm run preview
```

## Roadmap

1. Replace the starter textarea with Monaco or another mobile-tested editor.
2. Add proper project import/export and file management.
3. Add GitHub sign-in using a secure, documented authentication flow.
4. Build a real terminal through a separately deployed, authenticated workspace backend (never expose arbitrary shell execution from an unauthenticated web server).
5. Package the web experience for Android and test on physical devices.
6. Add tests, accessibility checks, security review, and release automation.

## Security notes

- JavaScript preview runs inside an iframe sandbox without same-origin privileges.
- The demo terminal only simulates a small set of commands.
- Do not paste secrets into the prototype. Local browser storage is not an encrypted secret store.
- A production terminal needs authentication, isolation, resource limits, and explicit authorization.

## Contributing

Issues and pull requests are welcome. Please describe the device/browser tested and include reproduction steps for bugs.

## License

MIT. See [LICENSE](LICENSE).
