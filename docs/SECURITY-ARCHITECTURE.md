# Security Architecture

## Trust boundaries

The Android application is trusted to start its own local shell. The editor is not a trust boundary by itself.

The native terminal must constrain workspace paths and must not expose unrestricted remote execution.

## Planned production boundary

```
UI
 |
Terminal API
 |
Native process/PTY layer
 |
Workspace sandbox
 |
Developer userspace/runtime
```

For hosted execution, add:

```
Authentication -> per-user sandbox -> resource limits -> network policy -> ephemeral workspace
```

## Verification

Security-sensitive changes should be covered by automated tests and, where practical, external review.

The project must not claim a certification, audit, penetration test, or security guarantee unless the corresponding independent process has actually occurred.
