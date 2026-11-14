import type { JSX } from 'react';
import type { Verdict } from '@/types/ui';
import { useApp } from '@/state/AppContext';

const ICONS: Record<Verdict, string> = {
  Good: '✓',
  Fair: '~',
  Poor: '!',
};

/** Always icon + word, never colour alone. */
export function VerdictChip({ verdict }: { verdict: Verdict }): JSX.Element {
  const { t } = useApp();
  const className =
    verdict === 'Good'
      ? 'verdict-chip verdict-chip--good'
      : verdict === 'Fair'
        ? 'verdict-chip verdict-chip--fair'
        : 'verdict-chip verdict-chip--poor';
  return (
    <span className={className}>
      <span aria-hidden="true">{ICONS[verdict]}</span>
      <span>{t(`common.verdict${verdict}`)}</span>
    </span>
  );
}
