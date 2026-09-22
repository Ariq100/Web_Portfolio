import { useMemo } from 'react';
import { TerminalSession, type Step } from '../components/TerminalSession';
import { BigName } from '../components/BigName';
import { profile } from '../data/profile';
import { formatLogin, login } from '../lastLogin';
import { useBoot } from '../boot';

export function Home() {
  const { booted } = useBoot();
  const steps = useMemo<Step[]>(
    () => [
      {
        cwd: '~',
        command: 'whoami',
        output: [
          <BigName text={profile.name} />,
          <p className="role">
            <span className="c-dim">// </span>
            {profile.role}
          </p>,
          <p className="role">
            <span className="c-dim">// </span>
            {profile.location}
          </p>,
        ],
      },
      {
        cwd: '~',
        command: 'cat fun-facts.txt',
        output: [
          <span className="c-dim">
            # {profile.funFacts.length} fun facts about me
          </span>,
          ...profile.funFacts.map((fact, i) => (
            <p className="fact">
              <span className="fact-num">{String(i + 1).padStart(2, '0')}</span>
              <span>{fact}</span>
            </p>
          )),
        ],
      },
    ],
    [],
  );

  return (
    <section id="home" className="panel panel-home" aria-label="Home">
      <div className="window" data-depth>
        {booted && <p className="line c-dim login-line">{formatLogin(login)}</p>}
        <TerminalSession steps={steps} start={booted} finalCwd="~" lineDelay={160} />
        <a className={`scroll-hint${booted ? '' : ' is-hidden'}`} href="#about">
          <span className="c-dim">scroll to</span> <span className="c-green">cd ./about-me</span>
          <span className="scroll-arrow" aria-hidden="true">
            ↓
          </span>
        </a>
      </div>
    </section>
  );
}
