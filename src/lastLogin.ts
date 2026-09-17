const KEY = 'portfolio:last-login';

export interface LoginRecord {
  /** When this visitor previously opened the site, or now on their first visit. */
  at: Date;
  /** Visit number, shown as the tty like macOS does. */
  tty: string;
  firstVisit: boolean;
}

/**
 * Reads the previous visit and records the current one, once per page load.
 * Mirrors macOS Terminal, which shows the time of your *previous* login.
 */
function readAndRecord(): LoginRecord {
  const now = new Date();
  let previous: Date | null = null;
  let count = 0;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { at?: string; count?: number };
      const d = parsed.at ? new Date(parsed.at) : null;
      if (d && !Number.isNaN(d.getTime())) previous = d;
      count = parsed.count ?? 0;
    }
    localStorage.setItem(KEY, JSON.stringify({ at: now.toISOString(), count: count + 1 }));
  } catch {
    // Storage blocked (private mode etc.): fall back to this session.
  }
  return { at: previous ?? now, tty: `ttys${String(count % 1000).padStart(3, '0')}`, firstVisit: !previous };
}

export const login = readAndRecord();

export function formatLogin({ at, tty }: LoginRecord) {
  const day = at.toLocaleDateString('en-US', { weekday: 'short' });
  const month = at.toLocaleDateString('en-US', { month: 'short' });
  const date = String(at.getDate()).padStart(2, ' ');
  const time = at.toLocaleTimeString('en-GB', { hour12: false });
  return `Last login: ${day} ${month} ${date} ${time} on ${tty}`;
}
