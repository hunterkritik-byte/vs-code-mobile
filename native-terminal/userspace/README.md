# Application-owned developer userspace

VS Code Mobile keeps developer state under app-private storage: workspace, home, prefix, bin, and tmp.

The terminal sets HOME, PATH, and VSMOBILE_ROOT to these locations.

This is intentionally not described as a complete Linux distribution. Android's kernel and platform ABI remain underneath the application. A complete compiler/runtime distribution requires shipping or installing architecture-specific runtime packages.

The userspace layer is designed around signed, versioned runtime bundles so Node.js, Python, Git and other developer tools can be added without depending on the Termux application.
