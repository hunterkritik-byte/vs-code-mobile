import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const android=path.join(root,"android");
const source=path.join(root,"native-terminal","NativeTerminalPlugin.kt");
const ptyDir=path.join(root,"native-terminal","pty");
if(!fs.existsSync(android)) throw new Error("android/ does not exist. Run npm run android:add first.");
const appSrc=path.join(android,"app","src","main","java","dev","hunterkritik","vsmobile","terminal");
fs.mkdirSync(appSrc,{recursive:true});
fs.copyFileSync(source,path.join(appSrc,"NativeTerminalPlugin.kt"));
const ptySrc=path.join(android,"app","src","main","cpp");
fs.mkdirSync(ptySrc,{recursive:true});
fs.copyFileSync(path.join(ptyDir,"vsmobile_pty.cpp"),path.join(ptySrc,"vsmobile_pty.cpp"));
const ptyKt=path.join(android,"app","src","main","java","dev","hunterkritik","vsmobile","terminal","pty");
fs.mkdirSync(ptyKt,{recursive:true});
fs.copyFileSync(path.join(ptyDir,"PtyBridge.kt"),path.join(ptyKt,"PtyBridge.kt"));
fs.copyFileSync(path.join(ptyDir,"CMakeLists.txt"),path.join(ptySrc,"CMakeLists.txt"));
function findMainActivity(dir){const stack=[dir];while(stack.length){const cur=stack.pop();for(const e of fs.readdirSync(cur,{withFileTypes:true})){const full=path.join(cur,e.name);if(e.isDirectory()) stack.push(full); else if(e.name==="MainActivity.java"||e.name==="MainActivity.kt") return full;}}return null;}
const main=findMainActivity(path.join(android,"app","src","main"));
if(!main) throw new Error("Could not find Capacitor MainActivity");
let sourceText=fs.readFileSync(main,"utf8");
const kotlin=main.endsWith(".kt");
const importLine=kotlin?"import dev.hunterkritik.vsmobile.terminal.NativeTerminalPlugin":"import dev.hunterkritik.vsmobile.terminal.NativeTerminalPlugin;";
if(!sourceText.includes(importLine)){const pos=sourceText.indexOf("\n");sourceText=sourceText.slice(0,pos+1)+importLine+"\n"+sourceText.slice(pos+1);}
if(!sourceText.includes("registerPlugin(NativeTerminalPlugin")){
  if(kotlin){sourceText=sourceText.replace(/class MainActivity\\s*:\\s*BridgeActivity\\(\\)\\s*\\{/,"class MainActivity : BridgeActivity() {\\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\\n        super.onCreate(savedInstanceState)\\n        registerPlugin(NativeTerminalPlugin::class.java)\\n    }");}
  else {sourceText=sourceText.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,"public class MainActivity extends BridgeActivity {\\n    @Override\\n    public void onCreate(android.os.Bundle savedInstanceState) {\\n        super.onCreate(savedInstanceState);\\n        registerPlugin(NativeTerminalPlugin.class);\\n    }");}
}
fs.writeFileSync(main,sourceText);
console.log("NativeTerminalPlugin installed into "+main);
const gradle = path.join(android,"app","build.gradle");
const gradleKts = path.join(android,"app","build.gradle.kts");
const gradlePath = fs.existsSync(gradle) ? gradle : gradleKts;
if (!gradlePath) throw new Error("Android app Gradle file not found");
let g = fs.readFileSync(gradlePath,"utf8");
if (!g.includes("externalNativeBuild")) {
  const block = gradlePath.endsWith(".kts")
    ? '\nandroid {\\n    externalNativeBuild {\\n        cmake { path = file("src/main/cpp/CMakeLists.txt") }\\n    }\\n    defaultConfig { externalNativeBuild { cmake { cppFlags += "" } } }\\n}\\n'
    : '\nandroid {\\n    externalNativeBuild {\\n        cmake { path "src/main/cpp/CMakeLists.txt" }\\n    }\\n}\\n';
  g += block.replace(/\\\\n/g,"\\n");
  fs.writeFileSync(gradlePath,g);
}
console.log("Installed native PTY sources and Gradle CMake integration.");
