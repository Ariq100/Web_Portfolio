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
  /** Loader is gone and the home session starts typing. */
  booted: boolean;
  /** The nav bar has been revealed (happens while the name decodes). */
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

export function showNav() {
  if (!state.navVisible) set({ navVisible: true });
}

const MIN_DURATION = 1800;
const EXIT_DURATION = 650;
let started = false;

/** Runs every loading task in order, reporting progress to the boot screen. */
export async function runBoot() {
  if (started) return;
  started = true;
  const t0 = performance.now();

  const tasks: { label: string; run: () => Promise<unknown> }[] = [
    { label: 'mounting /dev/portfolio', run: () => new Promise((r) => setTimeout(r, 250)) },
    { label: 'loading fonts', run: () => document.fonts.ready },
  ];
  // three.js and the model builders live in a separate chunk.
  const threeTask = { label: 'loading three.js', run: async () => {} };
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

  const elapsed = performance.now() - t0;
  if (elapsed < MIN_DURATION) await new Promise((r) => setTimeout(r, MIN_DURATION - elapsed));
  set({ ready: true, progress: 1 });
  await new Promise((r) => setTimeout(r, EXIT_DURATION));
  set({ booted: true });
}
