import test from "node:test";
import assert from "node:assert/strict";
import { buildCommand as recon } from "../src/index.mjs";
import { buildCommand as http } from "../packages/http/src/index.mjs";
import { buildCommand as service } from "../packages/service/src/index.mjs";
import { buildCommand as password } from "../packages/password/src/index.mjs";
import { TOOL_TIMEOUT_MS, TOOL_EXEC_TIMEOUT_MS, TOOL_IDLE_TIMEOUT_MS, TOOL_MCP_TIMEOUT_MS } from "../packages/runtime/src/index.mjs";
import { readFile } from "node:fs/promises";

test("every locked image and pack profile agrees on the extended live budget", async () => {
  for (const pack of ["recon","http","nuclei","sqlmap","service","web-context","pcap","file-analysis","password","reference","metasploit"]) {
    const path=pack==="recon"?"../tools.lock.json":`../packages/${pack}/tools.lock.json`;
    const lock=JSON.parse(await readFile(new URL(path,import.meta.url),"utf8"));
    assert.deepEqual(lock.execution,{timeoutMs:TOOL_TIMEOUT_MS,execTimeoutMs:TOOL_EXEC_TIMEOUT_MS,synchronous:true},pack);
    if (pack==="metasploit") continue;
    const module=await import(pack==="recon"?"../src/index.mjs":`../packages/${pack}/src/index.mjs`);
    const input={recon:{tool:"httpx",target:"https://example.com/"},http:{tool:"curl",target:"https://example.com/"},nuclei:{tool:"nuclei",target:"https://example.com/"},sqlmap:{tool:"sqlmap",target:"https://example.com/?id=1",parameter:"id"},service:{tool:"nmap",target:"192.0.2.1",ports:[443]},"web-context":{tool:"whatweb",target:"https://example.com/"},pcap:{tool:"tshark"},"file-analysis":{tool:"binwalk"},password:{tool:"hashcat"},reference:{tool:"searchsploit",query:"fixture"}}[pack];
    assert.equal(module.buildCommand(input).timeoutMs,900000,pack);
  }
  assert(TOOL_EXEC_TIMEOUT_MS>TOOL_TIMEOUT_MS);
  assert(TOOL_IDLE_TIMEOUT_MS>TOOL_EXEC_TIMEOUT_MS);
  assert(TOOL_MCP_TIMEOUT_MS>TOOL_EXEC_TIMEOUT_MS+180000);
});
test("whole-tool limits allow the extended run while connection limits stay bounded", () => {
  const curl=http({tool:"curl",target:"https://example.com/"}).argv;
  assert.equal(curl[curl.indexOf("--max-time")+1],"900");
  assert.equal(curl[curl.indexOf("--connect-timeout")+1],"10");
  const ffuf=http({tool:"ffuf",target:"https://example.com/"}).argv;
  assert.equal(ffuf[ffuf.indexOf("-maxtime")+1],"900");
  const nmap=service({tool:"nmap",target:"192.0.2.1",ports:[443]}).argv;
  assert.equal(nmap[nmap.indexOf("--host-timeout")+1],"900s");
  assert(password({tool:"hashcat",view:"sha256-dictionary"}).argv.includes("--runtime=900"));
  const katana=recon({tool:"katana",target:"https://example.com/"}).argv;
  assert.equal(katana[katana.indexOf("-ct")+1],"900s");
  const subfinder=recon({tool:"subfinder",target:"example.com"}).argv;
  assert.equal(subfinder[subfinder.indexOf("-max-time")+1],"15");
});
