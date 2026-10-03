import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Braces, Check, ChevronDown, ChevronRight, CircleHelp, Code2, FileCode2, FilePlus2, Files, GitBranch, Github, Play, Plus, Search, Settings2, ShieldCheck, Smartphone, X } from "lucide-react";
import "./styles.css";

const initialFiles = {
  "src/main.js": '// Welcome to VS Code Mobile\n// A touch-friendly workspace for coding anywhere.\n\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}\n\nconsole.log(greet("developer"));\n',
  "src/utils.js": "export function add(a, b) {\n  return a + b;\n}\n\nexport function clamp(value, min, max) {\n  return Math.min(Math.max(value, min), max);\n}\n",
  "index.html": '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>My project</title>\n  </head>\n  <body>\n    <h1>Hello, world!</h1>\n  </body>\n</html>\n',
  "README.md": "# My project\n\nA small project created in VS Code Mobile.\n\nEdit src/main.js and press Run to try JavaScript in the preview sandbox.\n"
};

function highlight(line) {
  const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/(\/\/.*)$/g, '<span class="tok-comment">$1</span>')
    .replace(/(&quot;.*?&quot;|".*?"|'.*?')/g, '<span class="tok-string">$1</span>')
    .replace(/\b(const|let|var|function|return|export|import|from|if|else|new|class|async|await)\b/g, '<span class="tok-keyword">$1</span>')
    .replace(/\b(console|Math|Promise)\b/g, '<span class="tok-object">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
}

function App() {
  const [files, setFiles] = useState(() => {
    try { return { ...initialFiles, ...JSON.parse(localStorage.getItem("vscm-files") || "{}") }; }
    catch { return initialFiles; }
  });
  const [activeFile, setActiveFile] = useState("src/main.js");
  const [activePanel, setActivePanel] = useState("explorer");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLines, setTerminalLines] = useState([
    { type: "muted", text: "VS Code Mobile demo terminal" },
    { type: "muted", text: "Commands are simulated; this is not a real system shell yet." },
    { type: "success", text: "Workspace ready." }
  ]);
  const [searchText, setSearchText] = useState("");
  const [toast, setToast] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [showRun, setShowRun] = useState(false);
  const editorRef = useRef(null);
  const terminalRef = useRef(null);
  const iframeRef = useRef(null);
  const htmlPreviewRef = useRef(null);
  const code = files[activeFile] ?? "";
  const lines = code.split("\n");
  const visibleFiles = useMemo(() => Object.keys(files).filter(p => p.toLowerCase().includes(searchText.toLowerCase())), [files, searchText]);

  useEffect(() => { localStorage.setItem("vscm-files", JSON.stringify(files)); }, [files]);
  useEffect(() => {
    const listener = (event) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.kind !== "vscm-console") return;
      setRunOutput(current => current + (current ? "\n" : "") + event.data.message);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }
  function updateCode(value) { setFiles(current => ({ ...current, [activeFile]: value })); }
  function addFile() {
    const name = window.prompt("New file path (example: src/app.js)");
    if (!name) return;
    const path = name.trim().replace(/^\/+/, "");
    if (!path || path.split("/").includes("..")) return notify("Please enter a safe relative path.");
    if (files[path] !== undefined) { setActiveFile(path); return notify("That file already exists."); }
    setFiles(current => ({ ...current, [path]: "" }));
    setActiveFile(path); setActivePanel("explorer"); setSidebarOpen(false); notify("File created");
  }
  function runCode() {
    setRunOutput("");
    setShowRun(true);
    if (activeFile.endsWith(".html")) {
      if (htmlPreviewRef.current) htmlPreviewRef.current.srcdoc = code;
      setRunOutput("HTML loaded in the isolated preview frame.");
      return;
    }
    if (!activeFile.endsWith(".js")) return notify("Run preview currently supports JavaScript and HTML.");
    const safeSource = code.replace(/<\/script/gi, "<\\/script");
    if (iframeRef.current) iframeRef.current.srcdoc = '<!doctype html><body><script>' +
      'const send=(...a)=>parent.postMessage({kind:"vscm-console",message:a.map(v=>{try{return typeof v==="string"?v:JSON.stringify(v)}catch{return String(v)}}).join(" ")},"*");' +
      'console.log=send;console.info=send;console.warn=(...a)=>send("Warning:",...a);console.error=(...a)=>send("Error:",...a);' +
      'window.onerror=(m,s,l)=>send("Error:",m,"at line",l);try{' + safeSource +
      '\n}catch(e){send("Error:",e.message)}<\/script></body>';
  }
  function runCommand(raw) {
    const command = raw.trim();
    if (!command) return;
    const add = (type, text) => setTerminalLines(current => [...current, { type, text }]);
    add("prompt", "$ " + command);
    const [verb, ...args] = command.split(/\s+/);
    const path = args.join(" ");
    if (verb === "help") {
      add("normal", "Demo commands: help, ls, pwd, cat <file>, echo <text>, clear");
      add("muted", "A real shell backend is planned for a future milestone.");
    } else if (verb === "ls") Object.keys(files).forEach(file => add("normal", file));
    else if (verb === "pwd") add("normal", "/workspace");
    else if (verb === "cat") {
      if (files[path] !== undefined) files[path].split("\n").forEach(line => add("normal", line));
      else add("error", "cat: " + (path || "missing path") + ": file not found");
    } else if (verb === "echo") add("normal", command.slice(5));
    else if (verb === "clear") setTerminalLines([]);
    else { add("error", "Command not available in demo terminal: " + verb); add("muted", "Try 'help' for supported demo commands."); }
    setTerminalInput("");
    requestAnimationFrame(() => terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: "smooth" }));
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand-mark" aria-label="Toggle sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}><Code2 size={21}/></button>
      <div className="brand-copy"><strong>VS Code Mobile</strong><span>developer workspace</span></div>
      <div className="topbar-spacer"/>
      <div className="workspace-pill"><span className="live-dot"/> my-project</div>
      <button className="icon-button hide-mobile" title="Search files" onClick={() => { setActivePanel("search"); setSidebarOpen(true); }}><Search size={17}/></button>
      <button className="icon-button" title="Settings" onClick={() => notify("Settings are coming soon")}><Settings2 size={17}/></button>
      <a className="github-button" href="https://github.com/hunterkritik-byte/vs-code-mobile" target="_blank" rel="noreferrer"><Github size={16}/><span>GitHub</span></a>
    </header>
    <div className="workspace">
      <nav className="activity-bar" aria-label="Workspace panels">
        <button className={activePanel === "explorer" ? "activity active" : "activity"} title="Explorer" onClick={() => { setActivePanel("explorer"); setSidebarOpen(true); }}><Files size={21}/></button>
        <button className={activePanel === "search" ? "activity active" : "activity"} title="Search" onClick={() => { setActivePanel("search"); setSidebarOpen(true); }}><Search size={21}/></button>
        <button className={activePanel === "source" ? "activity active" : "activity"} title="Source control" onClick={() => { setActivePanel("source"); setSidebarOpen(true); }}><GitBranch size={21}/></button>
        <div className="activity-spacer"/>
        <button className="activity" title="Help" onClick={() => notify("Tip: edit a file, then press Run")}><CircleHelp size={20}/></button>
      </nav>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-heading"><span>{activePanel === "explorer" ? "EXPLORER" : activePanel === "search" ? "SEARCH" : "SOURCE CONTROL"}</span><button className="subtle-icon" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={15}/></button></div>
        {activePanel === "explorer" && <>
          <div className="folder-heading"><ChevronDown size={14}/><span>MY-PROJECT</span><button className="subtle-icon" onClick={addFile} title="New file"><FilePlus2 size={15}/></button></div>
          <div className="file-list">{visibleFiles.map(path => <button key={path} className={activeFile === path ? "file-row selected" : "file-row"} onClick={() => { setActiveFile(path); setSidebarOpen(false); }}>
            {path.endsWith(".js") ? <Braces size={15} className="file-icon js-icon"/> : <FileCode2 size={15} className={path.endsWith(".html") ? "file-icon html-icon" : "file-icon"}/>}
            <span>{path}</span>{files[path] !== initialFiles[path] && <span className="dirty-dot"/>}
          </button>)}</div>
          <button className="new-file-button" onClick={addFile}><Plus size={14}/> New file</button>
        </>}
        {activePanel === "search" && <>
          <label className="search-label" htmlFor="file-search">Filter files</label><input id="file-search" className="search-input" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Filename..."/>
          <div className="file-list">{visibleFiles.map(path => <button key={path} className="file-row" onClick={() => { setActiveFile(path); setActivePanel("explorer"); setSidebarOpen(false); }}><FileCode2 size={15}/><span>{path}</span></button>)}</div>
        </>}
        {activePanel === "source" && <div className="source-panel"><GitBranch size={22}/><strong>Source Control</strong><p>Git integration is on the roadmap.</p><button className="outline-button" onClick={() => notify("Git integration is planned for a future milestone")}>View roadmap</button></div>}
        <div className="sidebar-footer"><ShieldCheck size={14}/><span>Local demo workspace</span></div>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}/>}
      <main className="editor-area">
        <div className="tabbar"><div className="file-tab"><span className="tab-language">{activeFile.endsWith(".js") ? "JS" : activeFile.endsWith(".html") ? "◇" : "M"}</span><span>{activeFile.split("/").pop()}</span><span className="tab-dirty">●</span></div>
          <div className="tabbar-actions"><button className="icon-button run-button" onClick={runCode}><Play size={14} fill="currentColor"/><span>Run</span></button></div>
        </div>
        <div className="breadcrumbs"><span>my-project</span><ChevronRight size={13}/><span>{activeFile.split("/").slice(0, -1).join("/") || "root"}</span><ChevronRight size={13}/><strong>{activeFile.split("/").pop()}</strong></div>
        <section className="editor" aria-label="Code editor">
          <div className="line-numbers" aria-hidden="true">{lines.map((_, i) => <div key={i}>{i + 1}</div>)}</div>
          <div className="editor-input-wrap"><pre className="syntax-layer" aria-hidden="true">{lines.map((line, i) => <div key={i} dangerouslySetInnerHTML={{ __html: highlight(line) || " " }}/>)}</pre>
            <textarea ref={editorRef} className="code-input" value={code} onChange={e => updateCode(e.target.value)} onKeyDown={e => {
              if (e.key === "Tab") { e.preventDefault(); const el = e.currentTarget; const start = el.selectionStart; const end = el.selectionEnd; updateCode(code.slice(0, start) + "  " + code.slice(end)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; }); }
              if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); localStorage.setItem("vscm-files", JSON.stringify(files)); notify("Saved locally"); }
            }} spellCheck="false" autoCapitalize="off" autoCorrect="off" aria-label={"Edit " + activeFile}/>
          </div>
        </section>
        {showRun && <section className="run-output"><div className="output-heading"><span><Play size={13}/> RUN OUTPUT</span><button className="subtle-icon" onClick={() => setShowRun(false)} aria-label="Close output"><X size={15}/></button></div>{activeFile.endsWith(".html") ? <iframe title="HTML preview" ref={htmlPreviewRef} className="html-preview" sandbox="allow-scripts"/> : <pre>{runOutput || "Running…"}</pre>}</section>}
        <section className={`terminal-panel ${terminalOpen ? "" : "terminal-collapsed"}`}>
          <div className="terminal-header"><div className="terminal-tabs"><span className="terminal-tab muted-tab">PROBLEMS <b>0</b></span><span className="terminal-tab muted-tab">OUTPUT</span><span className="terminal-tab active">TERMINAL</span></div>
            <div className="terminal-actions"><button className="subtle-icon" onClick={() => setTerminalOpen(!terminalOpen)} title="Toggle terminal"><ChevronDown size={15}/></button><button className="subtle-icon" onClick={() => setTerminalLines([])} title="Clear terminal"><X size={15}/></button></div>
          </div>
          {terminalOpen && <div className="terminal-content" ref={terminalRef}>{terminalLines.map((line, i) => <div key={i} className={`terminal-line ${line.type}`}>{line.text}</div>)}
            <form className="terminal-prompt" onSubmit={e => { e.preventDefault(); runCommand(terminalInput); }}><span>$</span><input value={terminalInput} onChange={e => setTerminalInput(e.target.value)} placeholder="Type 'help' for demo commands" aria-label="Terminal command"/></form>
          </div>}
        </section>
        <footer className="statusbar"><span><GitBranch size={12}/> main*</span><span>Ln {lines.length}, Col 1</span><span>{activeFile.endsWith(".js") ? "JavaScript" : activeFile.endsWith(".html") ? "HTML" : "Markdown"}</span><span className="status-saved"><Check size={12}/> Auto-saved</span></footer>
      </main>
    </div>
    <footer className="mobile-hint"><Smartphone size={13}/><span>Built for touch • Works on mobile and desktop</span><span className="hint-separator">·</span><span>Prototype</span></footer>
    {toast && <div className="toast" role="status">{toast}</div>}
    <iframe ref={iframeRef} title="Isolated code preview" className="execution-frame" sandbox="allow-scripts"/>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
