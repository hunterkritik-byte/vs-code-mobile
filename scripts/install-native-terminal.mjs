import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const android=path.join(root,"android");
const source=path.join(root,"native-terminal","NativeTerminalPlugin.kt");
if(!fs.existsSync(android)) throw new Error("android/ does not exist. Run npm run android:add first.");
const appSrc=path.join(android,"app","src","main","java","dev","hunterkritik","vsmobile","terminal");
fs.mkdirSync(appSrc,{recursive:true});
fs.copyFileSync(source,path.join(appSrc,"NativeTerminalPlugin.kt"));
function findMainActivity(dir){const stack=[dir];while(stack.length){const cur=stack.pop();for(const e of fs.readdirSync(cur,{withFileTypes:true})){const full=path.join(cur,e.name);if(e.isDirectory()) stack.push(full); else if(e.name==="MainActivity.java"||e.name==="MainActivity.kt") return full;}}return null;}
const main=findMainActivity(path.join(android,"app","src","main"));
if(!main) throw new Error("Could not find Capacitor MainActivity");
let sourceText=fs.readFileSync(main,"utf8");
const kotlin=main.endsWith(".kt");
const importLine=kotlin?"import dev.hunterkritik.vsmobile.terminal.NativeTerminalPlugin":"import dev.hunterkritik.vsmobile.terminal.NativeTerminalPlugin;";
if(!sourceText.includes(importLine)){const pos=sourceText.indexOf("\n");sourceText=sourceText.slice(0,pos+1)+importLine+"\n"+sourceText.slice(pos+1);}
if(!sourceText.includes("NativeTerminalPlugin")){
  if(kotlin){sourceText=sourceText.replace(/class MainActivity\\s*:\\s*BridgeActivity\\(\\)\\s*\\{/,"class MainActivity : BridgeActivity() {\\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\\n        super.onCreate(savedInstanceState)\\n        registerPlugin(NativeTerminalPlugin::class.java)\\n    }");}
  else {sourceText=sourceText.replace(/public class MainActivity extends BridgeActivity\\s*\\{/,"public class MainActivity extends BridgeActivity {\\n    @Override\\n    public void onCreate(android.os.Bundle savedInstanceState) {\\n        super.onCreate(savedInstanceState);\\n        registerPlugin(NativeTerminalPlugin.class);\\n    }");}
}
fs.writeFileSync(main,sourceText);
console.log("NativeTerminalPlugin installed into "+main);