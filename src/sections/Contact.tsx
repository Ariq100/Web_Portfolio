import { useMemo } from 'react';
import type { Step } from '../components/TerminalSession';
import { ScrollTerminalSession } from '../components/ScrollTerminalSession';
import { profile } from '../data/profile';

export function Contact() {
  const width = Math.max(...profile.contact.map((c) => c.label.length));

  const steps = useMemo<Step[]>(
    () => [
      { cwd: '~/projects', command: 'cd ../contact' },
      {
        cwd: '~/contact',
        command: 'cat contact.txt',
        output: [
          <span className="c-dim"># say hi — I usually reply within a day</span>,
          <span />,
          ...profile.contact.map((c) => (
            <p className="kv">
              <span className="kv-key c-magenta">{c.label.padEnd(width, ' ')}</span>
              <span className="c-dim"> → </span>
              <a
                className="contact-link"
                href={c.href}
                target={c.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
              >
                {c.value}
              </a>
            </p>
          )),
        ],
      },
    ],
    [width],
  );

  return (
    <section id="contact" className="panel panel-contact" aria-label="Contact">
      <div className="window" data-depth>
        <h2 className="section-tag">
          <span className="c-dim">##</span> contact
        </h2>
        <ScrollTerminalSession steps={steps} finalCwd="~/contact" />
      </div>
      <footer className="footer c-dim">
        © {new Date().getFullYear()} {profile.name} · built with React, TypeScript &amp; three.js · [Process completed]
      </footer>
    </section>
  );
}
