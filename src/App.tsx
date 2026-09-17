import { lazy, Suspense, useEffect } from 'react';
import { TearCanvas } from './components/TearCanvas';
import { TerminalNav, type NavSection } from './components/TerminalNav';
import { Home } from './sections/Home';
import { About } from './sections/About';
import { Projects } from './sections/Projects';
import { Contact } from './sections/Contact';
import { startMotionLoop } from './motion';
import { BootScreen } from './components/BootScreen';
import { runBoot, useBoot } from './boot';
import { profile } from './data/profile';

// three.js is heavy; it is fetched (and the wireframes built) by the boot screen.
const Scene3D = lazy(() => import('./components/Scene3D').then((m) => ({ default: m.Scene3D })));

const SECTIONS: NavSection[] = [
  { id: 'home', label: 'home', path: '~' },
  { id: 'about', label: 'about-me', path: '~/about-me' },
  { id: 'projects', label: 'projects', path: '~/projects' },
  { id: 'contact', label: 'contact', path: '~/contact' },
];

export default function App() {
  const { ready, navVisible } = useBoot();

  useEffect(() => {
    document.title = profile.name;
    runBoot();
    return startMotionLoop();
  }, []);

  return (
    <>
      <TearCanvas />
      {ready && (
        <Suspense fallback={null}>
          <Scene3D />
        </Suspense>
      )}
      <div className="scanlines" aria-hidden="true" />
      <TerminalNav sections={SECTIONS} visible={navVisible} />
      <BootScreen />
      <main className="content">
        <Home />
        <About />
        <Projects />
        <Contact />
      </main>
    </>
  );
}
