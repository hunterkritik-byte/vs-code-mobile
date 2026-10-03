package dev.hunterkritik.vsmobile.terminal.pty

object PtyBridge {
    init { System.loadLibrary("vsmobile_pty") }
    external fun start(cwd: String, home: String, path: String, term: String, cols: Int, rows: Int): Long
    external fun write(handle: Long, data: ByteArray): Int
    external fun read(handle: Long, maxBytes: Int): ByteArray?
    external fun resize(handle: Long, cols: Int, rows: Int): Boolean
    external fun stop(handle: Long): Int
}
