import { useMemo } from 'react';
import type { Step } from '../components/TerminalSession';
import { ScrollTerminalSession } from '../components/ScrollTerminalSession';
import { profile } from '../data/profile';
import { WireframeTitle } from '../components/WireframeTitle';

export function Projects() {
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
                <span className="project-when c-dim">{p.when}</span>
              </div>
              <p className="project-desc">
                <span className="c-dim">└─ </span>
                {p.description}
              </p>
              {p.stack?.length || p.links?.length ? (
                <p className="project-stack">
                  {p.stack?.map((s) => (
                    <span className="chip" key={s}>
                      {s}
                    </span>
                  ))}
                  {p.links?.map((l) => (
                    <a className="project-link" key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                      ↗ {l.label}
                    </a>
                  ))}
                </p>
              ) : null}
            </article>
          )),
        ],
      },
    ],
    [],
  );

  return (
    <section id="projects" className="panel" aria-label="Projects">
      <div className="window" data-depth>
        <WireframeTitle text="Projects" />
        <ScrollTerminalSession steps={steps} finalCwd="~/projects" />
      </div>
    </section>
  );
}
