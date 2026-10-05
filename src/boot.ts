import { useSyncExternalStore } from 'react';

export interface BootStep {
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}

export interface BootState {
  steps: BootStep[];
  progress: number;
  /** All loading finished; the loader plays its exit animation. */
  ready: boolean;
  /** Assets are ready and the scroll experience is visible. */
  booted: boolean;
  /** The nav bar is visible once the assets are ready. */
  navVisible: boolean;
}

let state: BootState = { steps: [], progress: 0, ready: false, booted: false, navVisible: false };
const listeners = new Set<() => void>();

function set(patch: Partial<BootState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useBoot() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

const EXIT_DURATION = 650;
const MIN_LOADING_DURATION = 2000;
let started = false;

/** Runs every loading task in order, reporting progress to the boot screen. */
export async function runBoot() {
  if (started) return;
  started = true;
  const startedAt = performance.now();

  const tasks: { label: string; run: () => Promise<unknown> }[] = [
    { label: 'fetching data', run: () => document.fonts.ready },
  ];
  // three.js and the model builders live in a separate chunk.
  const threeTask = { label: 'life is too large, so using Git LFS', run: async () => {} };
  tasks.push(threeTask);

  set({ steps: tasks.map((t) => ({ label: t.label, status: 'pending' })) });

  const runTask = async (index: number, task: { run: () => Promise<unknown> }, total: number) => {
    set({ steps: state.steps.map((s, i) => (i === index ? { ...s, status: 'running' } : s)) });
    let ok = true;
    try {
      await task.run();
    } catch (err) {
      ok = false;
      console.error(err);
    }
    // Pace cached loads too, without adding a full delay after a slow download.
    const remaining = startedAt + ((index + 1) / total) * MIN_LOADING_DURATION - performance.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    set({
      steps: state.steps.map((s, i) => (i === index ? { ...s, status: ok ? 'done' : 'failed' } : s)),
      progress: (index + 1) / total,
    });
  };

  // Fixed tasks first, then the asset list once its module has loaded.
  let assetTasks: { label: string; run: () => Promise<unknown> }[] = [];
  threeTask.run = async () => {
    const [mod] = await Promise.all([import('./three/assets'), import('./components/Scene3D')]);
    assetTasks = mod.assetTasks;
  };
  const estimatedTotal = tasks.length + 6;
  for (let i = 0; i < tasks.length; i++) await runTask(i, tasks[i], estimatedTotal);

  set({ steps: [...state.steps, ...assetTasks.map((t) => ({ label: t.label, status: 'pending' as const }))] });
  const total = tasks.length + assetTasks.length;
  for (let i = 0; i < assetTasks.length; i++) await runTask(tasks.length + i, assetTasks[i], total);

  set({ ready: true, progress: 1 });
  await new Promise((r) => setTimeout(r, EXIT_DURATION));
  set({ booted: true, navVisible: true });
}
