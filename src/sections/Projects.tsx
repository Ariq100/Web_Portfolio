import { useMemo } from 'react';
import { TerminalSession, type Step } from '../components/TerminalSession';
import { useInView } from '../hooks/useInView';
import { profile } from '../data/profile';

export function Projects() {
  const [ref, inView] = useInView<HTMLElement>(0.25);

  const steps = useMemo<Step[]>(
    () => [
      { cwd: '~/about-me', command: 'cd ../projects' },
      {
        cwd: '~/projects',
        command: 'npm start',
        output: [
          <span />,
          <span className="c-dim">&gt; projects@1.0.0 start</span>,
          <span className="c-dim">&gt; node ls-projects.js</span>,
          <span />,
          <span className="c-green">
            ✔ found {profile.projects.length} project{profile.projects.length === 1 ? '' : 's'}
          </span>,
          <span />,
          ...profile.projects.map((p, i) => (
            <article className="project">
              <div className="project-head">
                <span className="c-dim">[{i + 1}]</span>
                <a className="project-name" href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.name}
                  <span className="project-open" aria-hidden="true">
                    ↗ open
                  </span>
                </a>
              </div>
              <p className="project-desc">
                <span className="c-dim">└─ </span>
                {p.description}
              </p>
              <p className="project-stack">
                {p.stack.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                  </span>
                ))}
              </p>
            </article>
          )),
        ],
      },
    ],
    [],
  );

  return (
    <section id="projects" ref={ref} className="panel" aria-label="Projects">
      <div className="window" data-depth>
        <h2 className="section-tag">
          <span className="c-dim">##</span> projects
        </h2>
        <TerminalSession steps={steps} start={inView} finalCwd="~/projects" lineDelay={140} />
      </div>
    </section>
  );
}
