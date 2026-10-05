import { useEffect, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#01$%&';

/** The original home entrance: decode the name, then keep its pointer-driven depth. */
export function BigName({ text, prefix }: { text: string; prefix: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (reduced) {
      setShown(text);
      return;
    }
    let frame = 0;
    const total = text.length * 4 + 10;
    const id = window.setInterval(() => {
      const revealed = Math.floor((++frame / total) * text.length);
      setShown(text.split('').map((ch, i) =>
        i < revealed || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      ).join(''));
      if (frame >= total) window.clearInterval(id);
    }, 35);
    return () => window.clearInterval(id);
  }, [text, reduced]);

  return (
    <h1 className="bigname" aria-label={`${prefix} ${text}`}>
      <span className="bigname-prefix" aria-hidden="true">{prefix}</span>
      <span className="bigname-inner" aria-hidden="true">{shown}</span>
    </h1>
  );
}
