# Security Policy

## Supported security scope

Security reports are especially important for:
- native Android terminal execution;
- process and PTY handling;
- workspace filesystem boundaries;
- WebSocket/backend authentication;
- command execution;
- dependency vulnerabilities;
- Android application permissions;
- sandbox/isolation failures.

## Reporting

Please report suspected vulnerabilities privately to **hunterkritik@gmail.com**.

Include:
- affected version/commit;
- Android/device or OS details;
- reproduction steps;
- security impact;
- logs or a minimal proof of concept when safe.

Please do not publicly disclose an exploitable vulnerability before a fix or coordinated disclosure.

## Security principles

The native terminal is a privileged capability. Remote multi-user execution must not be enabled merely by exposing the development backend to the Internet. Production hosting requires authentication, isolation, resource limits, network policy, and secret protection.
