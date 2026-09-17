import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Cursor, Prompt } from './Prompt';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface Step {
  cwd: string;
  command: string;
  output?: ReactNode[];
}

interface Props {
  steps: Step[];
  /** Typing begins once this flips to true. */
  start: boolean;
  /** Directory shown on the idle prompt after the last command. */
  finalCwd: string;
  typeDelay?: number;
  lineDelay?: number;
}

type Phase = 'typing' | 'output' | 'done';

interface State {
  step: number;
  chars: number;
  lines: number;
  phase: Phase;
}

export function TerminalSession({ steps, start, finalCwd, typeDelay = 55, lineDelay = 90 }: Props) {
  const reduced = useReducedMotion();
  const [s, setS] = useState<State>({ step: 0, chars: 0, lines: 0, phase: 'typing' });

  useEffect(() => {
    if (!start || s.phase === 'done') return;
    if (reduced) {
      setS({ step: steps.length, chars: 0, lines: 0, phase: 'done' });
      return;
    }

    const current = steps[s.step];
    const output = current.output ?? [];
    let timer: number;

    if (s.phase === 'typing') {
      if (s.chars < current.command.length) {
        // A little jitter makes the typing feel human.
        timer = window.setTimeout(
          () => setS((p) => ({ ...p, chars: p.chars + 1 })),
          typeDelay + Math.random() * typeDelay,
        );
      } else {
        // Pause before "pressing enter".
        timer = window.setTimeout(() => setS((p) => ({ ...p, phase: 'output', lines: 0 })), 420);
      }
    } else if (s.lines < output.length) {
      timer = window.setTimeout(() => setS((p) => ({ ...p, lines: p.lines + 1 })), lineDelay);
    } else {
      timer = window.setTimeout(() => {
        setS((p) =>
          p.step + 1 < steps.length
            ? { step: p.step + 1, chars: 0, lines: 0, phase: 'typing' }
            : { ...p, step: steps.length, phase: 'done' },
        );
      }, 380);
    }
    return () => window.clearTimeout(timer);
  }, [start, s, steps, reduced, typeDelay, lineDelay]);

  return (
    <div className="session">
      <div>
        {steps.map((step, i) => {
          if (i > s.step || (!start && i === 0)) return null;
          const isCurrent = i === s.step && s.phase !== 'done';
          const typed = isCurrent ? step.command.slice(0, s.chars) : step.command;
          const shownLines = !isCurrent ? step.output?.length ?? 0 : s.phase === 'output' ? s.lines : 0;
          return (
            <Fragment key={i}>
              <div className="line cmd">
                <Prompt cwd={step.cwd} />
                <span className="c-text">{typed}</span>
                {isCurrent && s.phase === 'typing' && <Cursor />}
              </div>
              {step.output?.slice(0, shownLines).map((line, j) => (
                <div className="line out" key={j}>
                  {line}
                </div>
              ))}
            </Fragment>
          );
        })}
        {!start && (
          <div className="line cmd">
            <Prompt cwd={steps[0].cwd} />
            <Cursor />
          </div>
        )}
        {s.phase === 'done' && (
          <div className="line cmd">
            <Prompt cwd={finalCwd} />
            <Cursor />
          </div>
        )}
      </div>
    </div>
  );
}
