import type { JSX } from 'react';
import { useApp } from '@/state/AppContext';

/** Three-step form shell. "I don't know" is a valid answer everywhere. */
export function Stepper({
  step,
  labels,
  onStep,
}: {
  step: number;
  labels: readonly string[];
  onStep?(step: number): void;
}): JSX.Element {
  const { t } = useApp();
  return (
    <nav className="stepper" aria-label={t('profile.title')}>
      {labels.map((label, index) => {
        const number = index + 1;
        const active = number === step;
        return (
          <div className="row" key={label} style={{ flex: 1, gap: 4, flexWrap: 'nowrap' }}>
            <button
              type="button"
              className={`stepper__dot ${active ? 'is-active' : ''}`}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${number}: ${label}`}
              onClick={() => onStep?.(number)}
            >
              {number}
            </button>
            <span className={`small ${active ? '' : 'muted'}`}>{label}</span>
            {index < labels.length - 1 ? <span className="stepper__line" /> : null}
          </div>
        );
      })}
    </nav>
  );
}
