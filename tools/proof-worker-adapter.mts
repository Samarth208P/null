import { Worker as Thread } from 'node:worker_threads';
/** Browser worker API backed by a disposable Node thread; same production prover. */
export class ProofWorker {
  onmessage?: (event: {data: unknown}) => void; onerror?: () => void;
  thread: Thread;
  constructor() {
    this.thread = new Thread(new URL('./prover-bootstrap.mjs', import.meta.url),{stdout:true,stderr:true});
    this.thread.on('message',data=>this.onmessage?.({data})); this.thread.on('error',()=>this.onerror?.());
    this.thread.stdout?.resume(); this.thread.stderr?.resume();
  }
  postMessage(data: unknown) { this.thread.postMessage(data); }
  terminate() { void this.thread.terminate(); }
}
