// Runs every test script in this folder, one at a time, and prints a summary.
//   node tests/run-all.js            — all of them
//   node tests/run-all.js calendar   — only files whose name contains "calendar"
// Exits non-zero when any script fails or times out. Each script is a plain Node program that
// exits non-zero on failure (see README.md); this runner only sequences them and collects results.
// Needs `npm i playwright` (or NODE_PATH pointing at a node_modules that has it). The browser is
// taken from SM_CHROME when set, else the path each script names.
const {spawnSync}=require('child_process');
const fs=require('fs'), path=require('path');
const dir=__dirname, filter=process.argv[2]||"";
const TIMEOUT=+(process.env.SM_TEST_TIMEOUT||240000);
const files=fs.readdirSync(dir).filter(f=>/\.(browser|test)\.js$/.test(f)&&f.includes(filter)).sort();
const failed=[]; const t0=Date.now();
for(const f of files){
  const s=Date.now();
  const r=spawnSync(process.execPath,[path.join(dir,f)],{encoding:'utf8',timeout:TIMEOUT,env:process.env});
  const ok=r.status===0;
  const secs=((Date.now()-s)/1000).toFixed(1);
  console.log(`${ok?'PASS':'FAIL'}  ${f}  (${secs}s)`);
  if(!ok){
    failed.push(f);
    const out=((r.stdout||"")+(r.stderr||"")).trim().split("\n");
    const lines=out.filter(l=>/FAIL|Error|✗|assert/i.test(l)).slice(0,12);
    (lines.length?lines:out.slice(-12)).forEach(l=>console.log("      "+l));
    if(r.error) console.log("      "+r.error.message);
  }
}
console.log(`\n${files.length-failed.length}/${files.length} passed in ${((Date.now()-t0)/1000).toFixed(0)}s`);
if(failed.length){ console.log("Failed: "+failed.join(", ")); process.exit(1); }
