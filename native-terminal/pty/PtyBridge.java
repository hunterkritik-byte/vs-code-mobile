package dev.hunterkritik.vsmobile.terminal.pty;

public final class PtyBridge {
    private static volatile boolean loaded = false;
    private PtyBridge() {}

    private static synchronized void ensureLoaded() {
        if (loaded) return;
        try {
            System.loadLibrary("vsmobile_pty");
            loaded = true;
        } catch (UnsatisfiedLinkError e) {
            throw new IllegalStateException("Native PTY library is unavailable for this Android ABI", e);
        }
    }

    public static long start(String cwd, String home, String path, String term, int cols, int rows) {
        ensureLoaded();
        return nativeStart(cwd, home, path, term, cols, rows);
    }

    public static int write(long handle, byte[] data) {
        ensureLoaded();
        return nativeWrite(handle, data);
    }

    public static byte[] read(long handle, int maxBytes) {
        ensureLoaded();
        return nativeRead(handle, maxBytes);
    }

    public static boolean resize(long handle, int cols, int rows) {
        ensureLoaded();
        return nativeResize(handle, cols, rows);
    }

    public static int stop(long handle) {
        ensureLoaded();
        return nativeStop(handle);
    }

    private static native long nativeStart(String cwd, String home, String path, String term, int cols, int rows);
    private static native int nativeWrite(long handle, byte[] data);
    private static native byte[] nativeRead(long handle, int maxBytes);
    private static native boolean nativeResize(long handle, int cols, int rows);
    private static native int nativeStop(long handle);
}