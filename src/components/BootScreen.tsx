import { useEffect, useState } from 'react';
import { useBoot } from '../boot';
import { profile } from '../data/profile';

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const BAR = 28;

export function BootScreen() {
  const { steps, progress, ready, booted } = useBoot();
  const [frame, setFrame] = useState(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => f + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  // Ease the displayed percentage toward the real one.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setShown((s) => {
        const next = s + (progress - s) * 0.12;
        return Math.abs(progress - next) < 0.002 ? progress : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  useEffect(() => {
    document.body.classList.toggle('is-booting', !booted);
  }, [booted]);

  if (booted) return null;

  const filled = Math.round(shown * BAR);
  return (
    <div className={`boot${ready ? ' boot-exit' : ''}`} role="status" aria-live="polite" aria-label="Loading">
      <div className="boot-inner">
        <div className="boot-logo" aria-hidden="true">
          <span className="c-green">&gt;</span>
          <span className="boot-logo-cursor">_</span>
        </div>
        <p className="boot-title">
          <span className="c-green">{profile.handle}</span>
          <span className="c-dim">@portfolio</span> <span className="c-dim">— booting</span>
        </p>
        <p className="boot-bar" aria-hidden="true">
          <span className="c-dim">[</span>
          <span className="c-green">{'█'.repeat(filled)}</span>
          <span className="boot-bar-empty">{'░'.repeat(BAR - filled)}</span>
          <span className="c-dim">]</span> <span className="boot-pct">{String(Math.round(shown * 100)).padStart(3, ' ')}%</span>
        </p>
        <ul className="boot-log">
          {steps.map((s) => (
            <li key={s.label} className={`boot-step ${s.status}`}>
              <span className="boot-icon">
                {s.status === 'done' ? '✔' : s.status === 'failed' ? '✖' : s.status === 'running' ? SPINNER[frame % SPINNER.length] : '·'}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
