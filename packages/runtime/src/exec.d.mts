export function execOutput(container: NonNullable<DurableObjectState["container"]>, argv: string[], options?: Omit<ContainerExecOptions,"signal"> & {timeoutMs?:number}): Promise<ExecOutput>;
