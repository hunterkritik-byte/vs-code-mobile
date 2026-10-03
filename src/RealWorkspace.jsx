import React, { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import Editor from "@monaco-editor/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Braces, ChevronDown, ChevronRight, Code2, FileCode2, FilePlus2, Files, FolderOpen, Github, GitBranch, Play, Plus, RefreshCw, Search, Smartphone, TerminalSquare, X } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import "./workspace.css";

const WORKSPACE_BASE = (import.meta.env.VITE_WORKSPACE_API_URL || "").replace(/\/$/, "");
const API = WORKSPACE_BASE + "/api";
function terminalUrl() {
  const base = WORKSPACE_BASE ? new URL(WORKSPACE_BASE) : new URL(window.location.href);
  return (base.protocol === "https:" ? "wss:" : "ws:") + "//" + base.host + "/terminal";
}
function languageFor(path = "") {
  const ext = path.split(".").pop().toLowerCase();
  return ({ js:"javascript", jsx:"javascript", ts:"typescript", tsx:"typescript", html:"html", css:"css", json:"json", md:"markdown", py:"python", sh:"shell", yml:"yaml", yaml:"yaml", xml:"xml", sql:"sql", rs:"rust", go:"go", java:"java", c:"c", h:"c", cpp:"cpp", hpp:"cpp" })[ext] || "plaintext";
}
function fileIcon(path) {
  return path.endsWith(".js") || path.endsWith(".jsx") || path.endsWith(".ts") ? <Braces size={15}/> : <FileCode2 size={15}/>;
}

const LOCAL_FILES_KEY = "vs-code-mobile:workspace:v1";
const STARTER_FILES = {
  "README.md": "# My Workspace\n\nThis project is stored locally in VS Code Mobile.\n",
  "src/main.js": 'console.log("Hello from VS Code Mobile!");\n',
  "src/app.py": 'print("Hello from Python on Android!")\n'
};
function readLocalFiles() {
  try {
    const stored = localStorage.getItem(LOCAL_FILES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    }
  } catch {}
  const initial = { ...STARTER_FILES };
  try { localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(initial)); } catch {}
  return initial;
}
function writeLocalFiles(files) {
  localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(files));
}
function normalizeLocalPath(path) {
  if (typeof path !== "string") throw new Error("Enter a file path.");
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some(part => !part || part === "." || part === "..") || normalized.includes("\0")) {
    throw new Error("Invalid file path. Use a relative path such as src/main.js.");
  }
  return normalized;
}

export default function RealWorkspace() {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [contents, setContents] = useState({});
  const [dirty, setDirty] = useState({});
  const [activePanel, setActivePanel] = useState("explorer");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [filter, setFilter] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting to workspace…");
  const [toast, setToast] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const editorRef = useRef(null);
  const terminalHostRef = useRef(null);
  const terminalRef = useRef(null);
  const socketRef = useRef(null);
  const fileTree = files.filter(path => path.toLowerCase().includes(filter.toLowerCase()));

  const notify = useCallback(message => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const request = useCallback(async (path, options = {}) => {
    if (sessionToken === "local") {
      const method = (options.method || "GET").toUpperCase();
      const url = new URL(path, window.location.origin);
      let localFiles = readLocalFiles();
      if (url.pathname === "/files" && method === "GET") {
        return { files: Object.keys(localFiles).sort() };
      }
      if (url.pathname === "/file") {
        if (method === "GET") {
          const filePath = normalizeLocalPath(url.searchParams.get("path") || "");
          if (!Object.prototype.hasOwnProperty.call(localFiles, filePath)) throw new Error("File not found: " + filePath);
          return { path: filePath, content: localFiles[filePath] };
        }
        let payload = {};
        try { payload = options.body ? JSON.parse(options.body) : {}; } catch { throw new Error("Invalid file request."); }
        const filePath = normalizeLocalPath(payload.path);
        if (method === "POST") {
          if (Object.prototype.hasOwnProperty.call(localFiles, filePath)) throw new Error("That file already exists.");
          localFiles[filePath] = "";
          writeLocalFiles(localFiles);
          return { path: filePath };
        }
        if (method === "PUT") {
          if (!Object.prototype.hasOwnProperty.call(localFiles, filePath)) throw new Error("File not found: " + filePath);
          if (typeof payload.content !== "string") throw new Error("File content must be text.");
          localFiles[filePath] = payload.content;
          writeLocalFiles(localFiles);
          return { path: filePath };
        }
        if (method === "DELETE") {
          if (!Object.prototype.hasOwnProperty.call(localFiles, filePath)) throw new Error("File not found: " + filePath);
          delete localFiles[filePath];
          writeLocalFiles(localFiles);
          return null;
        }
      }
      throw new Error("This operation is not supported in local workspace mode.");
    }
    const response = await fetch(API + path, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(sessionToken ? { Authorization: "Bearer " + sessionToken } : {}), ...options.headers }
    });
    const responseText = response.status === 204 ? "" : await response.text();
    const contentType = response.headers.get("content-type") || "";
    const preview = responseText.trim().slice(0, 80).toLowerCase();
    const looksLikeHtml = preview.startsWith("<!doctype") || preview.startsWith("<html") || preview.startsWith("<");
    if (!response.ok) {
      if (looksLikeHtml) throw new Error("Workspace backend is unavailable or returned a web page. Switch to local workspace mode or configure a valid backend URL.");
      throw new Error(responseText || "Request failed (" + response.status + ")");
    }
    if (response.status === 204) return null;
    if (!contentType.toLowerCase().includes("application/json")) {
      if (looksLikeHtml) throw new Error("Workspace backend returned HTML instead of JSON. Your files can still be edited in local workspace mode.");
      throw new Error("Workspace backend returned a non-JSON response. Check the backend URL and server logs.");
    }
    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error("Workspace backend returned invalid JSON. Check the backend URL and server logs.");
    }
  }, [sessionToken]);

  const refreshFiles = useCallback(async () => {
    const result = await request("/files");
    setFiles(result.files);
    return result.files;
  }, [request]);

  const loadFile = useCallback(async path => {
    if (contents[path] === undefined) {
      const result = await request("/file?path=" + encodeURIComponent(path));
      setContents(current => ({ ...current, [path]: result.content }));
    }
    setActiveFile(path);
    setOpenFiles(current => current.includes(path) ? current : [...current, path]);
    setSidebarOpen(false);
  }, [contents, request]);

  useEffect(() => {
    let cancelled = false;
    const useLocalWorkspace = () => {
      if (cancelled) return;
      readLocalFiles();
      setSessionToken("local");
      setConnected(true);
      setStatus(Capacitor.isNativePlatform() ? "Local files · run with Termux" : "Local workspace · saved on this device");
    };
    // Android uses device-local files and Termux, so it never needs a remote backend.
    if (Capacitor.isNativePlatform()) {
      useLocalWorkspace();
      return () => { cancelled = true; };
    }
    fetch(API + "/session").then(async response => {
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.toLowerCase().includes("application/json")) {
        useLocalWorkspace();
        return null;
      }
      try { return await response.json(); } catch { useLocalWorkspace(); return null; }
    }).then(data => {
      if (cancelled || !data) return;
      if (typeof data.token === "string" && data.token) setSessionToken(data.token);
      else useLocalWorkspace();
    }).catch(() => useLocalWorkspace());
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await request("/files");
        if (cancelled) return;
        setFiles(result.files);
        const first = result.files.includes("src/main.js") ? "src/main.js" : result.files[0];
        if (first) await loadFile(first);
        if (!cancelled) { setConnected(true); setStatus("Connected to local workspace"); }
      } catch (error) { if (!cancelled) setStatus(error.message); }
    })();
    return () => { cancelled = true; };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || sessionToken === "local" || !terminalHostRef.current || terminalRef.current) return;
    const terminal = new Terminal({
      cursorBlink:true, convertEol:true, fontFamily:"'JetBrains Mono', monospace",
      fontSize:window.innerWidth < 600 ? 11 : 12, scrollback:5000,
      theme:{ background:"#14161c", foreground:"#dce0e8", cursor:"#b6aaff", selectionBackground:"#6255a766", green:"#86d6ad", red:"#f19b9b", yellow:"#e6c66b", blue:"#8cc9df", magenta:"#b6aaff", cyan:"#8cc9df" }
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(terminalHostRef.current);
    terminalRef.current = terminal;
    const socket = new WebSocket(terminalUrl());
    socketRef.current = socket;
    let authenticated = false;
    socket.addEventListener("open", () => socket.send(JSON.stringify({ type:"auth", token:sessionToken })));
    socket.addEventListener("message", event => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "ready") {
        authenticated = true;
        setStatus("Terminal connected");
        terminal.write(data.message || "\r\nTerminal connected.\r\n");
        fit.fit();
        socket.send(JSON.stringify({ type:"resize", cols:terminal.cols, rows:terminal.rows }));
      } else if (data.type === "output") terminal.write(data.data);
      else if (data.type === "error") terminal.write("\r\n\x1b[31m" + data.message + "\x1b[0m\r\n");
      else if (data.type === "exit") terminal.write("\r\n\x1b[90mProcess exited (" + data.code + ").\x1b[0m\r\n");
    });
    socket.addEventListener("close", () => setStatus("Terminal disconnected"));
    socket.addEventListener("error", () => setStatus("Terminal connection failed"));
    terminal.onData(data => { if (authenticated && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type:"input", data })); });
    const resize = () => {
      try { fit.fit(); if (authenticated && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type:"resize", cols:terminal.cols, rows:terminal.rows })); } catch {}
    };
    const observer = new ResizeObserver(resize);
    observer.observe(terminalHostRef.current);
    window.addEventListener("resize", resize);
    requestAnimationFrame(resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      socket.close();
      terminal.dispose();
      terminalRef.current = null;
      socketRef.current = null;
    };
  }, [sessionToken]);

  const saveFile = useCallback(async path => {
    if (contents[path] === undefined || !dirty[path]) return;
    try {
      await request("/file", { method:"PUT", body:JSON.stringify({ path, content:contents[path] }) });
      setDirty(current => ({ ...current, [path]:false }));
      notify("Saved " + path);
    } catch (error) { notify("Save failed: " + error.message); }
  }, [contents, dirty, notify, request]);

  const createFile = async () => {
    const name = window.prompt("New file path (example: src/app.js)");
    if (!name) return;
    try {
      const result = await request("/file", { method:"POST", body:JSON.stringify({ path:name }) });
      await refreshFiles();
      await loadFile(result.path);
      setContents(current => ({ ...current, [result.path]:"" }));
      setDirty(current => ({ ...current, [result.path]:false }));
      notify("Created " + result.path);
    } catch (error) { notify("Could not create file: " + error.message); }
  };

  const deleteFile = async path => {
    if (!window.confirm("Delete " + path + "? This cannot be undone.")) return;
    try {
      await request("/file?path=" + encodeURIComponent(path), { method:"DELETE" });
      setContents(current => { const next = { ...current }; delete next[path]; return next; });
      setDirty(current => { const next = { ...current }; delete next[path]; return next; });
      setOpenFiles(current => current.filter(item => item !== path));
      const nextFiles = await refreshFiles();
      if (activeFile === path && nextFiles.length) await loadFile(nextFiles[0]);
      notify("Deleted " + path);
    } catch (error) { notify("Delete failed: " + error.message); }
  };

  const runFile = async () => {
    if (!activeFile) return;
    if (Capacitor.isNativePlatform()) {
      if (!activeFile.endsWith(".js") && !activeFile.endsWith(".py") && !activeFile.endsWith(".sh")) {
        notify("Termux Run currently supports JavaScript, Python, and shell files.");
        return;
      }
      try {
        const TermuxBridge = registerPlugin("TermuxBridge");
        const source = contents[activeFile] ?? "";
        const bytes = new TextEncoder().encode(source);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        const encoded = btoa(binary);
        const filename = (activeFile.split("/").pop() || "main.js").replace(/[^a-zA-Z0-9._-]/g, "_");
        const runtime = activeFile.endsWith(".py") ? "python" : activeFile.endsWith(".sh") ? "bash" : "node";
        const command = "mkdir -p \"$HOME/VSCodeMobile\" && printf '%s' '" + encoded + "' | base64 -d > \"$HOME/VSCodeMobile/" + filename + "\" && cd \"$HOME/VSCodeMobile\" && " + runtime + " \"" + filename + "\"; printf '\\n[VS Code Mobile] Command finished. Files are in ~/VSCodeMobile.\\n'; exec bash -l";
        await TermuxBridge.runCommand({ command });
        notify("Opening Termux to run " + filename);
      } catch {
        notify("Termux unavailable. Install Termux and enable external app commands in its settings.");
      }
      return;
    }
    await saveFile(activeFile);
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) { notify("Connect the terminal to run code."); return; }
    if (activeFile.endsWith(".html")) {
      window.open(WORKSPACE_BASE + "/workspace-preview/" + activeFile.split("/").map(encodeURIComponent).join("/"), "_blank", "noopener,noreferrer");
    } else if (activeFile.endsWith(".js")) {
      socket.send(JSON.stringify({ type:"input", data:"node \"" + activeFile.replace(/["\\\\]/g, "") + "\"\\r" }));
    } else {
      notify("Use the terminal to run this file with its language runtime.");
    }
  };

  const onEditorMount = editor => {
    editorRef.current = editor;
    editor.addCommand(2048 | 49, () => saveFile(activeFile));
  };

  return <div className="real-app">
    <header className="real-topbar">
      <button className="real-brand-icon" onClick={() => setSidebarOpen(value => !value)} aria-label="Toggle explorer"><Code2 size={21}/></button>
      <div className="real-brand-copy"><strong>VS Code Mobile</strong><span>open-source coding workspace</span></div>
      <div className="real-top-spacer"/>
      <span className={"connection-pill " + (connected ? "is-connected" : "")}><i/>{connected ? "Workspace" : "Connecting"}</span>
      <button className="real-icon-btn desktop-only" title="Search files" onClick={() => { setActivePanel("search"); setSidebarOpen(true); }}><Search size={17}/></button>
      <button className="real-icon-btn desktop-only" title="Refresh files" onClick={() => refreshFiles().catch(e => notify(e.message))}><RefreshCw size={16}/></button>
      <a className="real-github-btn" href="https://github.com/hunterkritik-byte/vs-code-mobile" target="_blank" rel="noreferrer"><Github size={16}/><span>GitHub</span></a>
    </header>
    <div className="real-workspace">
      <nav className="real-activity" aria-label="Workspace views">
        <button className={activePanel === "explorer" ? "active" : ""} title="Explorer" onClick={() => { setActivePanel("explorer"); setSidebarOpen(true); }}><Files size={21}/></button>
        <button className={activePanel === "search" ? "active" : ""} title="Search" onClick={() => { setActivePanel("search"); setSidebarOpen(true); }}><Search size={21}/></button>
        <button className={activePanel === "source" ? "active" : ""} title="Source control" onClick={() => { setActivePanel("source"); setSidebarOpen(true); }}><GitBranch size={21}/></button>
        <div className="real-activity-spacer"/>
        <button title="Terminal" onClick={() => setTerminalOpen(value => !value)}><TerminalSquare size={20}/></button>
      </nav>
      <aside className={"real-sidebar " + (sidebarOpen ? "open" : "")}>
        <div className="real-sidebar-heading"><span>{activePanel === "explorer" ? "EXPLORER" : activePanel === "search" ? "SEARCH" : "SOURCE CONTROL"}</span><button onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={15}/></button></div>
        {activePanel === "explorer" && <>
          <div className="real-folder-heading"><ChevronDown size={14}/><span>WORKSPACE</span><button onClick={createFile} title="New file"><FilePlus2 size={15}/></button><button onClick={() => refreshFiles().catch(e => notify(e.message))} title="Refresh"><RefreshCw size={14}/></button></div>
          <div className="real-file-list">{fileTree.map(path => <div className={"real-file-row " + (activeFile === path ? "selected" : "")} key={path}><button className="real-file-open" onClick={() => loadFile(path).catch(e => notify(e.message))}>{fileIcon(path)}<span>{path}</span>{dirty[path] && <i/>}</button><button className="real-file-delete" title={"Delete " + path} onClick={() => deleteFile(path)}><X size={13}/></button></div>)}</div>
          <button className="real-new-file" onClick={createFile}><Plus size={14}/> New file</button>
        </>}
        {activePanel === "search" && <><label className="real-search-label">Filter workspace files</label><input className="real-search-input" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Type a filename…"/><div className="real-file-list">{fileTree.map(path => <button className="real-file-open" key={path} onClick={() => loadFile(path).catch(e => notify(e.message))}>{fileIcon(path)}<span>{path}</span></button>)}</div></>}
        {activePanel === "source" && <div className="real-source"><GitBranch size={22}/><strong>Source Control</strong><p>Git integration is not wired into the UI yet. You can run git commands in the real terminal.</p></div>}
        <div className="real-sidebar-footer"><FolderOpen size={14}/><span>{status}</span></div>
      </aside>
      {sidebarOpen && <button className="real-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close explorer"/>}
      <main className="real-editor-area">
        <div className="real-tabbar">{openFiles.map(path => <button key={path} className={"real-tab " + (activeFile === path ? "selected" : "")} onClick={() => loadFile(path).catch(e => notify(e.message))}>{fileIcon(path)}<span>{path.split("/").pop()}</span>{dirty[path] && <i/>}<span className="real-tab-close" onClick={e => { e.stopPropagation(); setOpenFiles(current => current.filter(item => item !== path)); if (activeFile === path) { const next = openFiles.find(item => item !== path); if (next) loadFile(next).catch(err => notify(err.message)); } }}>×</span></button>)}<div className="real-tab-spacer"/><button className="real-run" onClick={runFile}><Play size={14} fill="currentColor"/><span>{Capacitor.isNativePlatform() ? "Run in Termux" : "Run"}</span></button></div>
        <div className="real-breadcrumb"><span>workspace</span><ChevronRight size={13}/><span>{activeFile.split("/").slice(0,-1).join("/") || "root"}</span><ChevronRight size={13}/><strong>{activeFile.split("/").pop()}</strong></div>
        <section className="real-editor"><Editor height="100%" path={activeFile || "untitled"} language={languageFor(activeFile)} theme="vs-dark" value={contents[activeFile] ?? ""} onChange={value => { setContents(current => ({ ...current, [activeFile]:value ?? "" })); setDirty(current => ({ ...current, [activeFile]:true })); }} onMount={onEditorMount} options={{ automaticLayout:true, minimap:{enabled:window.innerWidth > 900}, fontSize:13, fontFamily:"'JetBrains Mono', monospace", lineNumbers:"on", scrollBeyondLastLine:false, wordWrap:"off", tabSize:2, insertSpaces:true, smoothScrolling:true, cursorBlinking:"smooth", padding:{top:10,bottom:12}, suggestOnTriggerCharacters:true, quickSuggestions:true, bracketPairColorization:{enabled:true}, formatOnPaste:true, formatOnType:true, scrollbar:{verticalScrollbarSize:10,horizontalScrollbarSize:10}, stickyScroll:{enabled:false} }}/></section>
        <section className={"real-terminal-panel " + (terminalOpen ? "" : "collapsed")}><div className="real-terminal-header"><div><span className="muted">PROBLEMS <b>0</b></span><span className="muted">OUTPUT</span><span className="selected"><TerminalSquare size={13}/> TERMINAL</span></div><aside><button title="Focus terminal input" onClick={() => terminalRef.current?.focus()}><Plus size={14}/></button><button title="Toggle terminal" onClick={() => setTerminalOpen(value => !value)}><ChevronDown size={15}/></button></aside></div>{terminalOpen && <div className="real-terminal-host" ref={terminalHostRef} onClick={() => terminalRef.current?.focus()}/>}</section>
        <footer className="real-statusbar"><span><GitBranch size={12}/> main</span><span>{languageFor(activeFile)}</span><span>{dirty[activeFile] ? "Unsaved changes" : "Saved"}</span><span className="real-status-spacer"/><span>{connected ? (sessionToken === "local" ? "On-device files" : "Workspace connected") : status}</span></footer>
      </main>
    </div>
    <footer className="real-mobile-hint"><Smartphone size={13}/><span>Touch-friendly workspace</span><span>•</span><span>Independent open-source project</span></footer>
    {toast && <div className="real-toast" role="status">{toast}</div>}
  </div>;
}
