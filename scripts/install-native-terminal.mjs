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
const rootGradle = path.join(android,"build.gradle");
if (fs.existsSync(rootGradle)) {
  let root = fs.readFileSync(rootGradle,"utf8");
  if (!root.includes("kotlin-gradle-plugin")) {
    const dep = '        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25"';
    const buildscript = root.indexOf("buildscript {");
    if (buildscript >= 0) {
      const deps = root.indexOf("dependencies {", buildscript);
      if (deps >= 0) {
        const close = root.indexOf("}", deps);
        if (close >= 0) root = root.slice(0, close) + "\n" + dep + root.slice(close);
      }
    } else {
      root = 'buildscript {\n    repositories { google(); mavenCentral() }\n    dependencies {\n' + dep + '\n    }\n}\n\n' + root;
    }
    fs.writeFileSync(rootGradle,root);
  }
}

if (gradlePath.endsWith(".kts")) {
  if (!g.includes('org.jetbrains.kotlin.android')) {
    g = g.replace(/plugins\\s*\\{/, 'plugins {\n    id("org.jetbrains.kotlin.android") version "1.9.25"');
  }
} else if (!g.includes("org.jetbrains.kotlin.android")) {
  g = "apply plugin: 'org.jetbrains.kotlin.android'\n" + g;
}

if (gradlePath.endsWith(".kts")) {
  if (!g.includes("ndkVersion")) g=g.replace(/android\\s*\\{/,'android {\n    ndkVersion = "27.3.13750724"');
  if (!g.includes("externalNativeBuild")) g=g.replace(/android\\s*\\{/,'android {\n    externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt") } }');
} else {
  if (!g.includes("ndkVersion")) g=g.replace(/android\\s*\\{/,'android {\n    ndkVersion "27.3.13750724"');
  if (!g.includes("externalNativeBuild")) g=g.replace(/android\\s*\\{/,'android {\n    externalNativeBuild { cmake { path "src/main/cpp/CMakeLists.txt" } }');
}
fs.writeFileSync(gradlePath,g);
console.log("Installed native PTY sources, Kotlin plugin, and Gradle CMake integration.");
