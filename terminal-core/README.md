# Native Terminal Core

This directory defines the project-owned Android terminal layer.

The goal is to provide a real process-backed terminal without depending on the Termux application, Termux API, or Termux add-ons.

## Design

- TerminalSession owns the child process lifecycle.
- stdin is written directly to the child process.
- stdout and stderr are streamed back to the terminal UI.
- working directory and environment are controlled by the application.
- sessions can be terminated by the application.
- the implementation is deliberately separate from the web editor.

## Current implementation

The Android prototype launches the platform shell (/system/bin/sh) directly from the application process. This is not Termux.

A platform shell is only the first execution layer. It does not provide a complete Linux userspace or full PTY semantics by itself.

## Next native milestones

1. Replace pipe-only transport with a real PTY.
2. Propagate terminal dimensions with TIOCSWINSZ.
3. Handle signals and process groups.
4. Persist and restore sessions.
5. Add a controlled bundled userspace/runtime.
6. Add per-workspace filesystem and resource isolation.
7. Add integration tests on supported Android versions.

Do not expose a process-backed terminal to untrusted remote users without a separate sandbox.
