import { useMemo } from 'react';
import { TerminalSession, type Step } from '../components/TerminalSession';
import { useInView } from '../hooks/useInView';
import { profile } from '../data/profile';

export function About() {
  const [ref, inView] = useInView<HTMLElement>(0.3);
  const width = Math.max(...profile.about.details.map((d) => d.key.length));

  const steps = useMemo<Step[]>(
    () => [
      { cwd: '~', command: 'cd ./about-me' },
      {
        cwd: '~/about-me',
        command: 'npm start',
        output: [
          <span />,
          <span className="c-dim">&gt; about-me@1.0.0 start</span>,
          <span className="c-dim">&gt; node whoami.js --verbose</span>,
          <span />,
          <span className="c-green">✔ profile loaded in 0.42s</span>,
          <span />,
          ...profile.about.details.map((d) => (
            <p className="kv">
              <span className="kv-key c-cyan">{d.key.padEnd(width, ' ')}</span>
              <span className="c-dim"> : </span>
              <span className="c-text">{d.value}</span>
            </p>
          )),
          <span />,
          <p className="summary">
            <span className="c-yellow">README.md</span>
            <br />
            {profile.about.summary}
          </p>,
          <span />,
          <p className="skills">
            <span className="c-dim">skills: </span>
            {profile.about.skills.map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </p>,
        ],
      },
    ],
    [width],
  );

  return (
    <section id="about" ref={ref} className="panel" aria-label="About me">
      <div className="window" data-depth>
        <h2 className="section-tag">
          <span className="c-dim">##</span> about-me
        </h2>
        <TerminalSession steps={steps} start={inView} finalCwd="~/about-me" lineDelay={110} />
      </div>
    </section>
  );
}
