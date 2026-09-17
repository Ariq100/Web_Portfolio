import { useEffect, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { showNav } from '../boot';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#01$%&';

/** Large extruded name that decodes from random glyphs, tilting with the cursor. */
export function BigName({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? text : '');

  useEffect(() => {
    showNav();
    if (reduced) {
      setShown(text);
      return;
    }
    let frame = 0;
    const total = text.length * 4 + 10;
    const id = window.setInterval(() => {
      frame++;
      const revealed = Math.floor((frame / total) * text.length);
      setShown(
        text
          .split('')
          .map((ch, i) => (i < revealed || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(''),
      );
      if (frame >= total) {
        setShown(text);
        window.clearInterval(id);
      }
    }, 35);
    return () => window.clearInterval(id);
  }, [text, reduced]);

  return (
    <h1 className="bigname" aria-label={text}>
      <span className="bigname-inner" data-text={shown}>
        {shown}
      </span>
    </h1>
  );
}
