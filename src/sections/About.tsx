import { useMemo } from 'react';
import type { Step } from '../components/TerminalSession';
import { ScrollTerminalSession } from '../components/ScrollTerminalSession';
import { profile } from '../data/profile';
import { WireframeTitle } from '../components/WireframeTitle';

export function About() {
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
            {profile.about.summary.split('\n\n').map((para, i) => (
              <span className={`summary-para${i === 0 ? ' summary-lead' : ''}`} key={para}>
                {para}
              </span>
            ))}
          </p>,
          <span />,
          <span className="c-yellow">EXPERIENCE</span>,
          ...profile.about.experience.map((e) => (
            <div className="exp">
              <p>
                <span className="c-text exp-role">{e.role}</span>
                <span className="c-dim"> · {e.when}</span>
              </p>
              <p className="c-dim">
                {e.org}, {e.where}
              </p>
              {e.points.map((pt) => (
                <p className="exp-point" key={pt}>
                  <span className="c-dim">– </span>
                  {pt}
                </p>
              ))}
            </div>
          )),
          <span />,
          <span className="c-yellow">AT MONASH</span>,
          ...profile.about.involvement.map((item) => (
            <p className="exp-point">
              <span className="c-green">✔ </span>
              {item}
            </p>
          )),
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
    <section id="about" className="panel" aria-label="About me">
      <div className="window" data-depth>
        <WireframeTitle text="About me" />
        <ScrollTerminalSession steps={steps} finalCwd="~/about-me" />
      </div>
    </section>
  );
}
