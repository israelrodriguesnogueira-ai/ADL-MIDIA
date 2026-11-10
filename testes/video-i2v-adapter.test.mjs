import assert from "node:assert/strict";
import { createVideoAdapter, validateVideoRequest, validateJobStatus } from "../integracoes/video-i2v-adapter.mjs";

const request = {durationSeconds:5,aspectRatio:"9:16",sourceAssetId:"vestido_1234",motionPrompt:"Modelo caminha e gira naturalmente"};
assert.equal(validateVideoRequest(request).preserveProduct,true);
assert.equal(validateVideoRequest(request).commercialPublishingAllowed,false);
assert.throws(()=>validateVideoRequest({...request,durationSeconds:16}),RangeError);
assert.throws(()=>validateVideoRequest({...request,sourceAssetId:"https://private.example/file"}),TypeError);
assert.throws(()=>validateJobStatus({jobId:"job_123456",status:"succeeded"}),TypeError);
const backend={
 async submitJob(input){assert.equal(input.aspectRatio,"9:16");return {jobId:"job_123456",status:"queued"};},
 async getJob(id){assert.equal(id,"job_123456");return {jobId:id,status:"running"};}
};
const adapter=createVideoAdapter(backend);
assert.equal((await adapter.submit(request)).status,"queued");
assert.equal((await adapter.status("job_123456")).status,"running");
console.log("Testes do contrato de integração aprovados (mock; sem geração real).");
