import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import express from "express";
import helmet from "helmet";
import { WebSocketServer, WebSocket } from "ws";
import pty from "node-pty";

const app = express();
const HOST = process.env.WORKSPACE_HOST || "127.0.0.1";
const PORT = Number(process.env.WORKSPACE_PORT || 8787);
const ROOT = path.resolve(process.env.WORKSPACE_DIR || path.join(process.cwd(), "workspace"));
const TOKEN = process.env.WORKSPACE_TOKEN || crypto.randomBytes(32).toString("hex");
const MAX_FILE_BYTES = 1024 * 1024;
const blockedNames = new Set([".git", "node_modules", ".env", ".ssh", ".gnupg", ".aws"]);
const allowedOrigins = new Set((process.env.WORKSPACE_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,https://localhost").split(",").map(s => s.trim()).filter(Boolean));

await fs.mkdir(ROOT, { recursive: true });
await fs.mkdir(path.join(ROOT, "src"), { recursive: true });
try { await fs.access(path.join(ROOT, "src/main.js")); }
catch { await fs.writeFile(path.join(ROOT, "src/main.js"), 'function greet(name) {\n  return "Hello, " + name + "!";\n}\n\nconsole.log(greet("developer"));\n'); }

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return res.status(403).send("Origin not allowed");
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return origin ? res.sendStatus(204) : res.sendStatus(403);
  if (["POST", "PUT", "DELETE"].includes(req.method) && !origin) return res.status(403).send("Origin header required");
  next();
});
app.get("/api/session", (req, res) => {
  if (!req.headers.origin || !allowedOrigins.has(req.headers.origin)) return res.status(403).send("Open the app through the configured Vite origin.");
  res.set("Cache-Control", "no-store");
  res.json({ token: TOKEN });
});
app.use("/api", (req, res, next) => {
  if (req.path === "/session") return next();
  const token = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
  if (token.length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(TOKEN))) {
    return res.status(401).send("Workspace authentication required");
  }
  next();
});

function safePath(input) {
  if (typeof input !== "string" || !input.trim() || input.includes("\\") || input.includes("\0")) throw new Error("Invalid relative path");
  const segments = input.split("/");
  if (segments.some(part => !part || part === "." || part === ".." || blockedNames.has(part) || part.startsWith(".env") || part.startsWith("."))) throw new Error("Path contains a disallowed segment");
  const resolved = path.resolve(ROOT, input);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) throw new Error("Path escapes workspace");
  return { resolved, relative: segments.join("/") };
}
async function ensureNoSymlink(target, includeTarget = true) {
  const parts = path.relative(ROOT, target).split(path.sep).filter(Boolean);
  const count = includeTarget ? parts.length : Math.max(0, parts.length - 1);
  let cursor = ROOT;
  for (const part of parts.slice(0, count)) {
    cursor = path.join(cursor, part);
    try { if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error("Symbolic links are not allowed"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}
function sendError(res, error) {
  const status = /not found/i.test(error.message) ? 404 : /already exists/i.test(error.message) ? 409 : 400;
  res.status(status).send(error.message);
}
async function listFiles(dir = ROOT, prefix = "") {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (blockedNames.has(entry.name) || entry.name.startsWith(".env") || entry.name.startsWith(".")) continue;
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) out.push(...await listFiles(path.join(dir, entry.name), relative));
    else if (entry.isFile()) out.push(relative);
  }
  return out.sort();
}
app.get("/api/files", async (_req, res) => {
  try { res.json({ files: await listFiles() }); } catch (error) { sendError(res, error); }
});
app.get("/api/file", async (req, res) => {
  try {
    const { resolved, relative } = safePath(req.query.path);
    await ensureNoSymlink(resolved);
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return res.status(400).send("Path is not a file");
    if (stat.size > MAX_FILE_BYTES) return res.status(413).send("File exceeds 1 MiB editor limit");
    res.json({ path: relative, content: await fs.readFile(resolved, "utf8") });
  } catch (error) { sendError(res, error); }
});
app.post("/api/file", async (req, res) => {
  try {
    const { resolved, relative } = safePath(req.body?.path);
    await ensureNoSymlink(resolved, false);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await ensureNoSymlink(resolved, false);
    const handle = await fs.open(resolved, "wx", 0o600);
    await handle.close();
    res.status(201).json({ path: relative });
  } catch (error) { sendError(res, error); }
});
app.put("/api/file", async (req, res) => {
  try {
    const { resolved, relative } = safePath(req.body?.path);
    if (typeof req.body?.content !== "string") return res.status(400).send("content must be a string");
    if (Buffer.byteLength(req.body.content, "utf8") > MAX_FILE_BYTES) return res.status(413).send("File exceeds 1 MiB editor limit");
    await ensureNoSymlink(resolved);
    if (!(await fs.stat(resolved)).isFile()) return res.status(400).send("Path is not a file");
    await fs.writeFile(resolved, req.body.content, "utf8");
    res.json({ path: relative, saved: true });
  } catch (error) { sendError(res, error); }
});
app.delete("/api/file", async (req, res) => {
  try {
    const { resolved } = safePath(req.query.path);
    await ensureNoSymlink(resolved);
    if (!(await fs.lstat(resolved)).isFile()) return res.status(400).send("Only files can be deleted");
    await fs.unlink(resolved);
    res.status(204).end();
  } catch (error) { sendError(res, error); }
});
app.get("/workspace-preview/*", async (req, res) => {
  try {
    const { resolved } = safePath(req.params[0]);
    await ensureNoSymlink(resolved);
    if (!resolved.toLowerCase().endsWith(".html")) return res.status(415).send("Only HTML files can be previewed");
    const html = await fs.readFile(resolved, "utf8");
    res.set("Content-Security-Policy", "default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https:; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'");
    res.type("html").send(html);
  } catch (error) { sendError(res, error); }
});

const server = app.listen(PORT, HOST, () => {
  console.log("Workspace backend: http://" + HOST + ":" + PORT);
  console.log("Workspace directory: " + ROOT);
  console.log("SECURITY: terminal commands run as the current OS user. Keep this backend on loopback; do not expose it to the internet.");
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  if (req.url !== "/terminal" || !origin || !allowedOrigins.has(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});
wss.on("connection", ws => {
  let child = null;
  let authenticated = false;
  const authTimeout = setTimeout(() => { if (!authenticated) ws.close(4401, "Authentication timeout"); }, 5000);
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!authenticated) {
      if (msg.type !== "auth" || typeof msg.token !== "string" || msg.token.length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(msg.token), Buffer.from(TOKEN))) {
        ws.send(JSON.stringify({ type:"error", message:"Authentication failed" }));
        ws.close(4401, "Authentication failed");
        return;
      }
      authenticated = true;
      clearTimeout(authTimeout);
      const shell = process.platform === "win32" ? (process.env.COMSPEC || "powershell.exe") : (process.env.SHELL || "/bin/bash");
      try {
        child = pty.spawn(shell, process.platform === "win32" ? [] : ["-l"], {
          name:"xterm-256color", cols:100, rows:28, cwd:ROOT,
          env:{ ...process.env, TERM:"xterm-256color", COLORTERM:"truecolor" }
        });
        child.onData(data => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:"output", data })); });
        child.onExit(({ exitCode }) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:"exit", code:exitCode })); });
        ws.send(JSON.stringify({ type:"ready", message:"\r\nWorkspace: " + ROOT + "\r\nShell: " + shell + "\r\n\r\n" }));
      } catch (error) {
        ws.send(JSON.stringify({ type:"error", message:"Could not start terminal: " + error.message }));
        ws.close();
      }
      return;
    }
    if (!child) return;
    if (msg.type === "input" && typeof msg.data === "string" && msg.data.length <= 8192) child.write(msg.data);
    else if (msg.type === "resize" && Number.isInteger(msg.cols) && Number.isInteger(msg.rows)) child.resize(Math.max(20, Math.min(240, msg.cols)), Math.max(5, Math.min(100, msg.rows)));
  });
  ws.on("close", () => { clearTimeout(authTimeout); if (child) child.kill(); });
  ws.on("error", () => { clearTimeout(authTimeout); if (child) child.kill(); });
});
function shutdown() { wss.clients.forEach(client => client.close()); server.close(() => process.exit(0)); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
