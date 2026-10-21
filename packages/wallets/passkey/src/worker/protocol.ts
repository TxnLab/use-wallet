/** Messages the page sends to the key worker */
export type WorkerRequest =
  | { id: number; op: 'unlock'; entropy: ArrayBuffer; idleTimeoutMs?: number }
  | { id: number; op: 'sign'; bytes: Uint8Array }
  | { id: number; op: 'lock' }

/** Messages the key worker sends to the page */
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'locked'; reason: 'idle' }
  | { type: 'result'; id: number; ok: true; value: unknown }
  | { type: 'result'; id: number; ok: false; error: string }
