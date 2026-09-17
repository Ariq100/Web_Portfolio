import { useEffect, useState } from 'react';
import { profile } from '../data/profile';

export interface NavSection {
  id: string;
  label: string;
  path: string;
}

interface Props {
  sections: NavSection[];
  /** Hidden during boot; slides in while the name decodes. */
  visible: boolean;
}

/**
 * The navigation is a macOS Terminal title bar with one tab per section.
 * The title follows the "current directory", and number keys switch tabs.
 */
export function TerminalNav({ sections, visible }: Props) {
  const [active, setActive] = useState(sections[0].id);
  const [progress, setProgress] = useState(0);
  const [size, setSize] = useState({ cols: 80, rows: 24 });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const probe = window.innerHeight * 0.4;
      let current = sections[0].id;
      let sectionProgress = 0;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= probe) {
          current = s.id;
          sectionProgress = Math.min(1, Math.max(0, (probe - r.top) / Math.max(1, r.height)));
        }
      }
      setActive(current);
      setProgress(sectionProgress);
      // Pretend character cell is ~8.4 x 18 px, like a 14px mono font.
      setSize({ cols: Math.floor(window.innerWidth / 8.4), rows: Math.floor(window.innerHeight / 18) });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sections]);

  const go = (s: NavSection) => {
    setFlash(`cd ${s.path}`);
    window.setTimeout(() => setFlash(null), 1100);
    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!visible || e.metaKey || e.ctrlKey || e.altKey) return;
      const index = Number(e.key) - 1;
      if (index >= 0 && index < sections.length) go(sections[index]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const activeSection = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <header className={`titlebar-wrap${visible ? ' is-visible' : ''}`} aria-hidden={!visible} inert={!visible}>
      <div className="titlebar">
        <div className="lights">
          <button
            className="light red"
            aria-label="Back to top"
            title="close → back to top"
            onClick={() => go(sections[0])}
          />
          <button
            className="light yellow"
            aria-label="Jump to contact"
            title="minimise → contact"
            onClick={() => go(sections[sections.length - 1])}
          />
          <button
            className="light green"
            aria-label="Toggle fullscreen"
            title="zoom → fullscreen"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen?.();
            }}
          />
        </div>
        <div className="title" aria-live="polite">
          <span className="title-icon" aria-hidden="true">
            ▸_
          </span>
          {flash ? (
            <span className="c-green">{flash}</span>
          ) : (
            <>
              {profile.handle} — {activeSection.path}
              <span className="title-extra">
                {' '}
                — -zsh — {size.cols}×{size.rows}
              </span>
            </>
          )}
        </div>
        <div className="lights-spacer" />
      </div>

      <nav className="tabs" aria-label="Sections">
        {sections.map((s, i) => {
          const isActive = s.id === active;
          return (
            <a
              key={s.id}
              style={{ animationDelay: `${0.35 + i * 0.12}s` }}
              href={`#${s.id}`}
              className={`tab${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(s);
              }}
            >
              <span className="tab-key" aria-hidden="true">
                {i + 1}
              </span>
              <span className="tab-label">{s.label}</span>
              {isActive && <span className="tab-progress" style={{ transform: `scaleX(${progress})` }} />}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
