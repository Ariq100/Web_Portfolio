import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Cursor, Prompt } from './Prompt';
import type { Step } from './TerminalSession';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { introProgress, introRowProgress, layoutTop, rowProgress, smooth } from '../scroll';

/** Two pixels of page scrolling move the terminal by one pixel. */
const SCROLL_PACE = 2;

interface Props {
  steps: Step[];
  finalCwd: string;
  /** The opening identity is readable immediately; subsequent rows follow the sticky intro. */
  intro?: boolean;
}

/** Every visual frame is a function of scroll position, with no timers or reveal latch. */
export function ScrollTerminalSession({ steps, finalCwd, intro = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const rows = useMemo(() => [
    ...steps.flatMap((step) => [
      <div className="line cmd">
        <Prompt cwd={step.cwd} />
        <span className="c-text scroll-command" data-command-length={step.command.length}>
          {step.command}
        </span>
      </div>,
      ...(step.output ?? []).map((output) => <div className="line out">{output}</div>),
    ]),
    <div className="line cmd">
      <Prompt cwd={finalCwd} />
      <Cursor />
    </div>,
  ], [steps, finalCwd]);
  const initialRows = intro ? 1 + (steps[0]?.output?.length ?? 0) : 0;

  useLayoutEffect(() => {
    const session = ref.current;
    const content = contentRef.current;
    const panel = session?.closest<HTMLElement>('.panel');
    if (!session || !content || !panel) return;
    const elements = Array.from(session.querySelectorAll<HTMLElement>('.scroll-row'));
    const commands = elements.map((el) => el.querySelector<HTMLElement>('.scroll-command'));
    let geometry: { top: number; height: number }[] = [];
    let panelTop = 0;
    let panelHeight = 0;
    let viewport = 0;
    let maxScroll = 0;
    let navHeight = 0;
    let pinnedIntro = false;
    let extraScroll = 0;
    let scrollStart = 0;
    let frame = 0;
    let needsMeasure = true;

    const update = () => {
      frame = 0;
      if (needsMeasure) {
        viewport = window.innerHeight;
        const stage = panel.querySelector<HTMLElement>('.home-stage');
        pinnedIntro = intro && !!stage && getComputedStyle(stage).position === 'sticky';
        extraScroll = reduced || pinnedIntro ? 0 : content.offsetHeight * (SCROLL_PACE - 1);
        // Reserve the added distance before measuring, including flex-centred sections.
        session.style.setProperty('--scroll-runway', `${extraScroll}px`);
        maxScroll = Math.max(0, document.documentElement.scrollHeight - viewport);
        navHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
        geometry = elements.map((el) => ({ top: layoutTop(el), height: el.offsetHeight }));
        panelTop = layoutTop(panel);
        panelHeight = panel.offsetHeight;
        scrollStart = layoutTop(session) - viewport * 0.82;
        needsMeasure = false;
      }
      const y = window.scrollY;
      // Move within the reserved space to keep the compact terminal layout while
      // spreading its reveals over more scrolling. This reverses without a timer.
      const offset = Math.min(extraScroll, Math.max(0, y - scrollStart) * (1 - 1 / SCROLL_PACE));
      session.style.setProperty('--session-offset', `${offset}px`);
      const progress = introProgress(y, panelTop, panelHeight, viewport, navHeight);
      let total = 0;
      elements.forEach((el, index) => {
        const p = reduced || index < initialRows ? 1 : pinnedIntro
          ? introRowProgress(progress, index - initialRows, elements.length - initialRows)
          : rowProgress(geometry[index].top + offset, geometry[index].height, y, viewport, maxScroll);
        total += p;
        el.style.setProperty('--reveal', smooth(p).toFixed(5));
        el.dataset.revealed = String(p > 0);
        const command = commands[index];
        if (command) {
          const length = Number(command.dataset.commandLength);
          command.style.setProperty('--typed', String(Math.floor(p * length) / length));
        }
      });
      const loaded = (total - initialRows) / Math.max(1, elements.length - initialRows);
      session.style.setProperty('--loaded', String(loaded));
      if (meter.current) meter.current.textContent = `${String(Math.round(loaded * 100)).padStart(3, '0')}%`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => { needsMeasure = true; schedule(); };
    const resize = new ResizeObserver(measure);
    resize.observe(session);
    resize.observe(content);
    resize.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('pageshow', measure);
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pageshow', measure);
    };
  }, [rows, reduced, intro, initialRows]);

  return (
    <div className={`session scroll-session${intro ? ' intro-session' : ''}`} ref={ref}>
      <div className="scroll-session-content" ref={contentRef}>
        <div className="session-load" aria-hidden="true">
          <span className="c-green">↓</span>
          <span>scroll to load</span>
          <span className="session-load-track"><span /></span>
          <span ref={meter} className="session-load-value">000%</span>
        </div>
        {rows.map((row, index) => (
          <div className="scroll-row" key={index}
            style={{ '--reveal': reduced || index < initialRows ? 1 : 0 } as CSSProperties}>
            <div className="scroll-row-content">{row}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
