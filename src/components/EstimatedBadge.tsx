import type { JSX } from 'react';

/** Estimated values use a label + icon + muted style — never colour alone. */
export function EstimatedBadge({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <span className="badge badge--estimated" title="This value is an estimate, not a measurement at your field">
      <span aria-hidden="true">◇</span>
      <span>{compact ? 'Est.' : 'Estimated'}</span>
    </span>
  );
}
