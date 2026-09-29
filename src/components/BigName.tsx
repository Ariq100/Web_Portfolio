/** The identity is readable on arrival; the surrounding terminal unfolds on scroll. */
export function BigName({ text }: { text: string }) {
  return (
    <h1 className="bigname">
      <span className="bigname-inner">{text}</span>
    </h1>
  );
}
