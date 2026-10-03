# Android terminal architecture

## Native PTY

The Android terminal now uses an application-owned PTY implemented with the Android NDK.

It provides:
- pseudo-terminal master/slave creation;
- session creation with setsid();
- controlling-terminal attachment;
- stdin/stdout/stderr through the PTY;
- terminal-size changes with TIOCSWINSZ;
- SIGWINCH propagation;
- process-group hangup/termination;
- private HOME/PATH environment;
- application-private workspace.

The UI communicates with the Kotlin Capacitor plugin, which bridges to the native PTY implementation.

## Userspace

The application owns a private developer tree:

    developer/
      bin/
      home/
      prefix/
        bin/
      tmp/
      workspace/

The current tree is a userspace foundation, not a complete Linux distribution. Android's kernel and platform ABI remain underneath it.

A genuinely complete developer environment requires architecture-specific, redistributable runtime/toolchain packages such as Python, Node.js, Git and compiler toolchains. Those packages must be supplied under licenses that permit redistribution and verified with hashes/signatures before installation.

The project therefore does not claim full Linux until those runtime packages are actually shipped or installed and tested.

## Security requirements
- Workspace paths are canonicalized and constrained.
- Terminal input is bounded.
- Terminal dimensions are bounded.
- Release signing keys must stay outside the repository.
- Runtime bundles must be hash/signature verified before activation.
- Remote execution must not be enabled without authentication and isolation.
