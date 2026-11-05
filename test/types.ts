import {buildCommand,type ReconRequest,type ReconResult} from '@memrov2/pentcloud-recon';
import type {ReconRunner} from '@memrov2/pentcloud-recon/worker';
const request:ReconRequest={tool:'httpx',target:'https://example.com/'};
buildCommand(request);
async function call(namespace:DurableObjectNamespace<ReconRunner>):Promise<ReconResult>{return namespace.getByName('assessment-run-id').run(request);}
void call;
// @ts-expect-error unsupported tool is rejected for typed consumers
buildCommand({tool:'sh',target:'example.com'});
