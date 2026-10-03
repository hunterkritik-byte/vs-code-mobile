package dev.hunterkritik.vsmobile.terminal

import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod
import dev.hunterkritik.vsmobile.terminal.pty.PtyBridge
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NativeTerminal")
class NativeTerminalPlugin : Plugin() {
    private var handle = 0L
    private val running = AtomicBoolean(false)
    private var reader: Thread? = null
    private val main = Handler(Looper.getMainLooper())
    private var root: File? = null

    @PluginMethod
    fun start(call: PluginCall) {
        if (running.get()) { call.resolve(JSObject().put("message", "\r\nNative PTY already running.\r\n")); return }
        val appRoot = File(context.filesDir, "developer").canonicalFile
        val workspace = File(appRoot, "workspace").canonicalFile
        val home = File(appRoot, "home").canonicalFile
        val prefix = File(appRoot, "prefix").canonicalFile
        val bin = File(appRoot, "bin").canonicalFile
        val tmp = File(appRoot, "tmp").canonicalFile
        listOf(workspace, home, prefix, bin, tmp).forEach { if (!it.exists()) it.mkdirs() }
        root = appRoot
        val requested = call.getString("cwd")
        val cwd = if (requested.isNullOrBlank()) workspace else File(workspace, requested).canonicalFile
        if (cwd != workspace && !cwd.path.startsWith(workspace.path + File.separator)) { call.reject("Working directory escapes workspace"); return }
        if (!cwd.exists()) cwd.mkdirs()
        val path = bin.absolutePath + ":" + File(prefix, "bin").absolutePath + ":/system/bin:/system/xbin"
        handle = PtyBridge.start(cwd.absolutePath, home.absolutePath, path, "xterm-256color", 80, 24)
        if (handle == 0L) { call.reject("Could not create Android PTY"); return }
        running.set(true)
        reader = thread(name = "vsmobile-pty-reader", isDaemon = true) {
            while (running.get()) {
                try {
                    val bytes = PtyBridge.read(handle, 8192)
                    if (bytes != null && bytes.isNotEmpty()) {
                        val data = String(bytes, Charsets.UTF_8)
                        main.post { if (running.get()) notifyListeners("output", JSObject().put("data", data)) }
                    } else Thread.sleep(8)
                } catch (_: Throwable) { break }
            }
        }
        call.resolve(JSObject().put("message", "\r\nVS Code Mobile native PTY\r\nWorkspace: " + workspace.absolutePath + "\r\nHOME: " + home.absolutePath + "\r\n\r\n"))
    }

    @PluginMethod
    fun write(call: PluginCall) {
        val data = call.getString("data") ?: ""
        if (data.length > 16384) { call.reject("Terminal input is too large"); return }
        if (!running.get()) { call.reject("Terminal is not running"); return }
        val rc = PtyBridge.write(handle, data.toByteArray(Charsets.UTF_8))
        if (rc < 0) call.reject("PTY write failed: " + rc) else call.resolve()
    }

    @PluginMethod
    fun resize(call: PluginCall) {
        if (!running.get()) { call.reject("Terminal is not running"); return }
        val cols = call.getInt("cols", 80)
        val rows = call.getInt("rows", 24)
        if (cols !in 2..400 || rows !in 2..200) { call.reject("Invalid terminal size"); return }
        if (!PtyBridge.resize(handle, cols, rows)) call.reject("PTY resize failed") else call.resolve()
    }

    @PluginMethod
    fun writeFile(call: PluginCall) {
        val relative = call.getString("path") ?: run { call.reject("path is required"); return }
        val content = call.getString("content") ?: ""
        if (relative.contains("..") || relative.startsWith("/") || relative.indexOf("\u0000") >= 0) { call.reject("Invalid workspace path"); return }
        val workspace = File(root ?: File(context.filesDir, "developer"), "workspace").canonicalFile
        val target = File(workspace, relative).canonicalFile
        if (target != workspace && !target.path.startsWith(workspace.path + File.separator)) { call.reject("Path escapes workspace"); return }
        if (content.toByteArray(Charsets.UTF_8).size > 1024 * 1024) { call.reject("File exceeds 1 MiB limit"); return }
        target.parentFile?.mkdirs(); target.writeText(content, Charsets.UTF_8); call.resolve(JSObject().put("path", relative))
    }

    @PluginMethod fun stop(call: PluginCall) { stopInternal(); call.resolve() }
    private fun stopInternal() { if (handle != 0L) { try { PtyBridge.stop(handle) } catch (_: Throwable) {} }; running.set(false); handle = 0L; reader = null }
    override fun handleOnDestroy() { stopInternal(); super.handleOnDestroy() }
}
