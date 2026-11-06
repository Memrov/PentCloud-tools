/** Clear the deadline at process exit, before buffered output may finish draining. */
export async function execOutput(container, argv, { timeoutMs = 90000, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const clear = () => clearTimeout(timer);
  let outputTimer;
  const deadline = new Promise((_,reject)=>{outputTimer=setTimeout(()=>reject(new Error("Native process output deadline exceeded")),timeoutMs);});
  const operation = async()=>{
    const process = await container.exec(argv, { ...options, signal: controller.signal });
    void process.exitCode.then(clear, clear);
    return process.output();
  };
  try {
    return await Promise.race([operation(),deadline]);
  } finally {
    clear();
    clearTimeout(outputTimer);
  }
}
