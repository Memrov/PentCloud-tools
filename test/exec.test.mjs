import test from "node:test";
import assert from "node:assert/strict";
import {setImmediate as nextTurn} from "node:timers/promises";
import {execOutput} from "../packages/runtime/src/exec.mjs";

test("a live native process is signaled at its deadline",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});
  let signal;
  const container={exec:async(_argv,options)=>{signal=options.signal;const stopped=new Promise(resolve=>signal.addEventListener("abort",()=>resolve(137),{once:true}));return {exitCode:stopped,output:async()=>({exitCode:await stopped})};}};
  const pending=execOutput(container,["controlled-process"],{timeoutMs:50});const outcome=pending.catch(e=>e);await nextTurn();
  t.mock.timers.tick(49);assert(!signal.aborted);t.mock.timers.tick(1);
  const result=await outcome;assert(signal.aborted);assert(result.exitCode===137||/deadline/.test(result.message));
});

test("stalled output hits the caller deadline without signaling an exited process",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});
  let signal,finish;
  const drained=new Promise(resolve=>{finish=resolve;});
  const container={exec:async(_argv,options)=>{signal=options.signal;return {exitCode:Promise.resolve(0),output:()=>drained};}};
  let error;
  const pending=execOutput(container,["completed-process"],{timeoutMs:50}).catch(e=>{error=e;});await nextTurn();
  t.mock.timers.tick(51);await nextTurn();
  try{assert(!signal.aborted);assert.match(error?.message??"",/deadline/);}finally{finish({exitCode:0});await pending;}
});
