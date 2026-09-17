import { profile } from '../data/profile';

export function Prompt({ cwd }: { cwd: string }) {
  return (
    <span className="prompt" aria-hidden="true">
      <span className="c-green">{profile.handle}@portfolio</span> <span className="c-cyan">{cwd}</span>{' '}
      <span className="c-text">%</span>{' '}
    </span>
  );
}

export function Cursor() {
  return <span className="cursor" aria-hidden="true" />;
}
