package dev.hunterkritik.vsmobile.terminal

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.OutputStream
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NativeTerminal")
class NativeTerminalPlugin : Plugin() {
    private var process: Process? = null
    private var stdin: OutputStream? = null
    private var workspace: File? = null
    private val running = AtomicBoolean(false)

    @PluginMethod
    fun start(call: PluginCall) {
        if (running.get()) { call.resolve(JSObject().put("message", "\r\nNative terminal already running.\r\n")); return }
        val root = File(context.filesDir, "workspace").canonicalFile
        if (!root.exists() && !root.mkdirs()) { call.reject("Could not create terminal workspace"); return }
        val requested = call.getString("cwd")
        val cwd = if (!requested.isNullOrBlank()) File(root, requested).canonicalFile else root
        if (cwd != root && !cwd.path.startsWith(root.path + File.separator)) { call.reject("Working directory escapes workspace"); return }
        if (!cwd.exists() && !cwd.mkdirs()) { call.reject("Could not create working directory"); return }
        try {
            val child = ProcessBuilder("/system/bin/sh", "-i").directory(cwd).redirectErrorStream(false).apply {
                environment()["TERM"] = environment()["TERM"] ?: "xterm-256color"
                environment()["HOME"] = context.filesDir.absolutePath
                environment()["PATH"] = "/system/bin:/system/xbin"
            }.start()
            process = child; stdin = child.outputStream; workspace = root; running.set(true)
            stream(child.inputStream); stream(child.errorStream)
            thread(name = "native-terminal-exit", isDaemon = true) {
                val code = try { child.waitFor() } catch (_: InterruptedException) { -1 }
                running.set(false); process = null; stdin = null
                notifyListeners("exit", JSObject().put("code", code))
            }
            call.resolve(JSObject().put("message", "\r\nVS Code Mobile native terminal\r\nWorkspace: ${root.absolutePath}\r\nShell: /system/bin/sh\r\n\r\n"))
        } catch (e: Exception) { running.set(false); process = null; stdin = null; call.reject("Could not start native terminal: ${e.message}") }
    }

    private fun stream(input: java.io.InputStream) {
        thread(name = "native-terminal-output", isDaemon = true) {
            val buffer = ByteArray(8192)
            while (running.get()) {
                val count = try { input.read(buffer) } catch (_: Exception) { break }
                if (count <= 0) break
                notifyListeners("output", JSObject().put("data", String(buffer, 0, count, Charsets.UTF_8)))
            }
        }
    }

    @PluginMethod fun write(call: PluginCall) {
        val data = call.getString("data") ?: ""
        if (data.length > 16384) { call.reject("Terminal input is too large"); return }
        try { stdin?.write(data.toByteArray(Charsets.UTF_8)); stdin?.flush(); call.resolve() }
        catch (e: Exception) { call.reject("Terminal write failed: ${e.message}") }
    }

    @PluginMethod fun writeFile(call: PluginCall) {
        val relative = call.getString("path") ?: run { call.reject("path is required"); return }
        val content = call.getString("content") ?: ""
        if (relative.contains("..") || relative.startsWith("/") || relative.indexOf("\u0000") >= 0) { call.reject("Invalid workspace path"); return }
        val root = workspace ?: File(context.filesDir, "workspace").canonicalFile
        val target = File(root, relative).canonicalFile
        if (target != root && !target.path.startsWith(root.path + File.separator)) { call.reject("Path escapes workspace"); return }
        if (content.toByteArray(Charsets.UTF_8).size > 1024 * 1024) { call.reject("File exceeds 1 MiB limit"); return }
        target.parentFile?.mkdirs(); target.writeText(content, Charsets.UTF_8); call.resolve(JSObject().put("path", relative))
    }

    @PluginMethod fun resize(call: PluginCall) { call.resolve() }

    @PluginMethod fun stop(call: PluginCall) { running.set(false); try { stdin?.close() } catch (_: Exception) {}; process?.destroy(); stdin = null; process = null; call.resolve() }

    override fun handleOnDestroy() { running.set(false); try { stdin?.close() } catch (_: Exception) {}; process?.destroy(); stdin = null; process = null; super.handleOnDestroy() }
}