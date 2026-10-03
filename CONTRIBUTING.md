# Contributing to VS Code Mobile

Thanks for helping build an independent mobile development environment.

## Development

1. Fork the repository.
2. Create a focused branch.
3. Make the smallest safe change.
4. Run the available tests and Android build checks.
5. Explain Android/device-specific behavior in the pull request.
6. Do not introduce a dependency on Termux or another external terminal application.

## Terminal changes

Terminal execution is security-sensitive. Changes to process creation, PTY handling, filesystem access, signals, networking, or package/runtime installation require tests and a security-focused explanation.

## Pull requests

Include:
- what changed;
- why it changed;
- test/device information;
- security implications;
- screenshots for UI changes when useful.

## Reporting security issues

Do not publish an exploitable vulnerability in a normal issue. Follow SECURITY.md.
