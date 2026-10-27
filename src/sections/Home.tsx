import { useCallback, useMemo, useState } from 'react';
import { TerminalSession, type Step } from '../components/TerminalSession';
import { BigName } from '../components/BigName';
import { profile } from '../data/profile';
import { formatLogin, login } from '../lastLogin';
import { useBoot } from '../boot';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { ScrollTerminalSession } from '../components/ScrollTerminalSession';
import { Prompt } from '../components/Prompt';

export function Home() {
  const { booted } = useBoot();
  const mobile = useMediaQuery('(max-width: 720px)');
  const [complete, setComplete] = useState(false);
  const handleComplete = useCallback(() => setComplete(true), []);
  const steps = useMemo<Step[]>(
    () => [
      {
        cwd: '~',
        command: 'whoami',
        output: [
          <BigName text={profile.name} prefix="Shadman Muhtasim" />,
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

  const mobileDetails = useMemo<Step[]>(() => [
    {
      cwd: '~', command: 'cat profile.txt', output: [
        <p className="role"><span className="c-dim">// </span>{profile.role}</p>,
        <p className="role"><span className="c-dim">// </span>{profile.location}</p>,
      ],
    },
    steps[1],
  ], [steps]);

  if (mobile) {
    return (
      <section id="home" className="panel panel-home" aria-label="Home" data-home-ready={booted}>
        <div className="home-stage">
          <div className="window">
            <div className="home-intro">
              <div className="home-portrait-slot" aria-hidden="true" />
              <div className={`home-identity${booted ? ' is-ready' : ''}`}>
                <div className="home-name-block">
                  <div className="line cmd"><Prompt cwd="~" /><span className="c-text">whoami</span></div>
                  <BigName text={profile.name} prefix="Shadman Muhtasim" />
                </div>
                <a className="scroll-hint" href="#home-details">
                  <span className="c-dim">scroll to explore</span><span className="scroll-arrow" aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
            <div id="home-details" className="home-details">
              <ScrollTerminalSession steps={mobileDetails} finalCwd="~" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="home" className="panel panel-home" aria-label="Home" data-home-ready={complete}>
      <div className="home-stage">
      <div className="window">
        {booted && <p className="line c-dim login-line">{formatLogin(login)}</p>}
        <TerminalSession steps={steps} start={booted} finalCwd="~" typeDelay={25} lineDelay={100} onComplete={handleComplete} />
        <a className={`scroll-hint${complete ? '' : ' is-hidden'}`} href="#about">
          <span className="c-dim">scroll to explore</span> <span className="c-green">cd ./about-me</span>
          <span className="scroll-arrow" aria-hidden="true">
            ↓
          </span>
        </a>
      </div>
      </div>
    </section>
  );
}
