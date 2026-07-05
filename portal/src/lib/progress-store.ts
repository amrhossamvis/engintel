type ProgressState = {
  logs: string[];
  done: boolean;
  createdAt: number;
};

const progressStore = new Map<string, ProgressState>();

const getState = (requestId: string) => {
  const existing = progressStore.get(requestId);
  if (existing) {
    return existing;
  }
  const created: ProgressState = { logs: [], done: false, createdAt: Date.now() };
  progressStore.set(requestId, created);
  return created;
};

export const initProgress = (requestId: string) => {
  progressStore.set(requestId, { logs: [], done: false, createdAt: Date.now() });
};

export const appendProgress = (requestId: string, message: string) => {
  const state = getState(requestId);
  state.logs.push(message);
};

export const markProgressDone = (requestId: string) => {
  const state = getState(requestId);
  state.done = true;
};

export const getProgressSnapshot = (requestId: string, offset: number) => {
  const state = getState(requestId);
  const safeOffset = Math.max(0, offset || 0);
  return {
    logs: state.logs.slice(safeOffset),
    done: state.done,
    nextOffset: state.logs.length,
  };
};

export const maybeCleanupProgress = (requestId: string, offset: number) => {
  const state = progressStore.get(requestId);
  if (!state) return;
  if (state.done && offset >= state.logs.length) {
    progressStore.delete(requestId);
  }
};
