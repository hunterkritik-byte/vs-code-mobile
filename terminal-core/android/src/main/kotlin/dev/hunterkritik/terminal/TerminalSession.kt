package dev.hunterkritik.terminal

import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStream
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

/**
 * Application-owned process terminal session.
 *
 * This implementation intentionally does not depend on an external terminal
 * application. It starts the Android platform shell directly and exposes its
 * stdio streams to the terminal UI.
 *
 * This is a pipe-backed prototype, not a full PTY. A PTY transport is planned
 * for proper interactive job control, resize handling and signal semantics.
 */
class TerminalSession(
    private val workingDirectory: String,
    private val environment: Map<String, String> = emptyMap(),
) {
    private var process: Process? = null
    private var input: OutputStream? = null

    private val outputListeners = CopyOnWriteArrayList<(String) -> Unit>()
    private val exitListeners = CopyOnWriteArrayList<(Int) -> Unit>()

    fun onOutput(listener: (String) -> Unit) {
        outputListeners += listener
    }

    fun onExit(listener: (Int) -> Unit) {
        exitListeners += listener
    }

    @Synchronized
    @Throws(IOException::class)
    fun start() {
        check(process == null) { "Terminal session already started" }

        val builder = ProcessBuilder("/system/bin/sh", "-i")
            .directory(java.io.File(workingDirectory))

        val env = builder.environment()
        env.putAll(environment)
        env["TERM"] = env["TERM"] ?: "xterm-256color"

        val child = builder.start()
        process = child
        input = child.outputStream

        startReader(child.inputStream)
        startReader(child.errorStream)

        thread(name = "terminal-exit", isDaemon = true) {
            val code = try {
                child.waitFor()
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                -1
            }

            synchronized(this) {
                if (process === child) {
                    process = null
                    input = null
                }
            }

            exitListeners.forEach { it(code) }
        }
    }

    private fun startReader(stream: java.io.InputStream) {
        thread(name = "terminal-output", isDaemon = true) {
            BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { reader ->
                val buffer = CharArray(4096)
                while (true) {
                    val count = try {
                        reader.read(buffer)
                    } catch (_: IOException) {
                        break
                    }
                    if (count < 0) break
                    if (count > 0) {
                        val chunk = String(buffer, 0, count)
                        outputListeners.forEach { it(chunk) }
                    }
                }
            }
        }
    }

    @Synchronized
    fun write(data: String) {
        val stream = input ?: return
        try {
            stream.write(data.toByteArray(Charsets.UTF_8))
            stream.flush()
        } catch (_: IOException) {
            // The child may have exited between the state check and write.
        }
    }

    @Synchronized
    fun stop() {
        val child = process ?: return
        process = null
        input = null
        child.destroy()
    }

    fun isRunning(): Boolean = synchronized(this) {
        process?.isAlive == true
    }
}
