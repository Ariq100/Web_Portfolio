import { useEffect, useRef, useState } from 'react';
import { profile } from '../data/profile';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useMediaQuery } from '../hooks/useMediaQuery';

export interface NavSection {
  id: string;
  label: string;
  path: string;
}

interface Props {
  sections: NavSection[];
  /** Hidden until the actual assets are ready. */
  visible: boolean;
}

/**
 * The navigation is a macOS Terminal title bar with one tab per section.
 * The title follows the "current directory", and number keys switch tabs.
 */
export function TerminalNav({ sections, visible }: Props) {
  const reduced = useReducedMotion();
  const mobile = useMediaQuery('(max-width: 720px)');
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
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
    setMenuOpen(false);
    setFlash(`cd ${s.path}`);
    window.setTimeout(() => setFlash(null), 1100);
    document.getElementById(s.id)?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!mobile) setMenuOpen(false);
  }, [mobile]);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

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
    <header ref={headerRef} className={`titlebar-wrap${visible ? ' is-visible' : ''}${menuOpen ? ' menu-open' : ''}`} aria-hidden={!visible} inert={!visible}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
      }}>
      <div className="titlebar">
        {/* Decorative only, like a screenshot of a terminal window. */}
        <div className="lights" aria-hidden="true">
          <span className="light red" />
          <span className="light yellow" />
          <span className="light green" />
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
        <button ref={toggleRef} className="nav-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen} aria-controls="section-navigation" onClick={() => setMenuOpen((open) => !open)}>
          <span className="hamburger" aria-hidden="true"><span /><span /><span /></span>
        </button>
      </div>

      <div className="nav-dropdown" inert={mobile && !menuOpen}>
      <nav id="section-navigation" className="tabs" aria-label="Sections" aria-hidden={mobile && !menuOpen}>
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
                if (mobile) toggleRef.current?.focus();
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
      </div>
    </header>
  );
}
