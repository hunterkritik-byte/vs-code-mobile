# VS Code Mobile — Independent Mobile Development Environment

> **Sponsor & partnership inquiries:** [hunterkritik@gmail.com](mailto:hunterkritik@gmail.com)

A community-built, touch-first development environment for Android and the web. The project combines a mobile code editor, workspace filesystem, terminal UI, and local execution into one independent developer tool.

**This is an independent project and is not an official Microsoft or Visual Studio Code product.**

## Why sponsor this project?

The goal is to make serious software development possible from a phone without requiring a desktop computer or a Termux installation.

Sponsorship directly supports:

- building the **independent Android terminal runtime**;
- improving the mobile coding and terminal experience;
- native process/PTY integration and shell tooling;
- security hardening and sandboxing;
- Android releases, documentation, testing, and accessibility;
- open-source maintenance and contributor infrastructure.

For sponsorship, engineering collaboration, infrastructure support, or partnership discussions, contact **hunterkritik@gmail.com**.

## Project direction

The project is moving away from third-party terminal-app dependencies and toward its own terminal stack.

### Terminal architecture

The terminal is designed as an application-owned stack:

```
Android / Web UI
      │
      ▼
Terminal View (xterm-compatible UI)
      │
      ▼
Terminal Session Manager
      │
      ├── stdin/stdout/stderr transport
      ├── resize + lifecycle handling
      ├── environment + working directory
      └── process supervision
      │
      ▼
Native Android process layer
      │
      ▼
Android shell / bundled developer runtime
```

**There is no Termux runtime, Termux bridge, or Termux add-on dependency in the target architecture.**

The terminal UI and session-management layer are project-owned. The Android implementation uses native application processes rather than launching a separate terminal application.

> The current implementation is being developed incrementally. A full PTY implementation, job control, signal handling, isolated userspace, and bundled language runtimes are roadmap items; they should not be described as complete until they are implemented and tested.

## Current features

- Monaco Editor with syntax highlighting, suggestions, multiple tabs, and editor shortcuts.
- xterm.js terminal interface.
- Workspace filesystem with create, read, edit, save, delete, and refresh operations.
- JavaScript execution through Node.js in the desktop/local development environment.
- Sandboxed HTML preview.
- Responsive desktop/mobile layout.
- Capacitor Android application packaging.
- GitHub Actions Android build workflow.

## Android terminal roadmap

The Android terminal is being built as a first-class component instead of depending on Termux:

- [x] Project-owned terminal UI.
- [x] Project-owned terminal session abstraction.
- [x] Native Android process execution prototype.
- [ ] Full PTY transport.
- [ ] Terminal resize and window-size propagation.
- [ ] Signal and process-group handling.
- [ ] Persistent terminal sessions.
- [ ] Bundled POSIX-compatible userspace.
- [ ] Package/runtime manager designed for this project.
- [ ] Per-workspace filesystem isolation.
- [ ] Resource limits and process cleanup.
- [ ] Security review before exposing remote execution features.

## Run the workspace locally

Requires Node.js 20+ and a native build toolchain for `node-pty` if a prebuilt binary is unavailable.

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm run dev
```

The backend creates a `workspace/` folder. Set `WORKSPACE_DIR` in `.env` to edit a different local project.

## Build Android

Install Android Studio and the Android SDK:

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

The Android project is generated in `android/`. A debug APK is also produced by the GitHub Actions Android workflow after relevant changes.

## No Termux dependency

The Android product is **not based on Termux**.

Older development builds experimented with a Termux execution bridge. That approach is no longer part of the target architecture. New terminal functionality must use the application's own terminal/session layer and native Android process integration.

Do not install Termux to use the terminal features described by the project roadmap.

## Local workspace backend

The optional Node.js workspace backend provides a shared filesystem, interactive desktop terminal, and HTML preview for local development.

The backend is intentionally a **trusted single-user development server**. It launches commands with the permissions of the OS user running the backend. Do not expose it directly to the public internet.

A future hosted multi-user service requires authentication, isolated containers/VMs, resource limits, storage quotas, network policy, and secret management.

## Web deployment

The static web application can provide the editor and local-first workspace UI. A separately hosted backend is required for a shared server-side filesystem and server-side terminal.

## Security

Security is a core project requirement. Terminal execution is a privileged capability and must not be treated as safe merely because it is embedded inside a UI.

Before production remote execution, the project must implement:

- authentication and authorization;
- per-user isolation;
- filesystem boundaries;
- CPU/memory/process limits;
- network restrictions;
- secret isolation;
- command/process lifecycle controls;
- audit logging where appropriate;
- security testing and review.

Report security issues privately through the repository's security policy rather than publishing an exploitable proof of concept.

## Sponsorship

This project is independently maintained and welcomes sponsorship from individuals, companies, cloud providers, hardware vendors, and developer-tool organizations.

Sponsor-supported work will prioritize the native Android terminal, security hardening, testing infrastructure, release automation, and documentation.

**Sponsorship / partnerships:** hunterkritik@gmail.com

## Branding

This project uses separately published Monaco Editor and xterm.js libraries rather than copying the full VS Code desktop application.

The project is independent and is **not affiliated with Microsoft**. Microsoft, Visual Studio Code, and related marks remain the property of their respective owners.

## Contributing

Issues and pull requests are welcome. Include your OS, Node.js version, Android version/device, reproduction steps, and relevant logs.

Licensed under MIT; see [LICENSE](LICENSE).
