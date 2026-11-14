import type { JSX } from 'react';
import type { SourceId } from '@/types/data';
import { EstimatedBadge } from './EstimatedBadge';

export interface SourceLabelProps {
  source: string;
  freshness: string;
  isEstimated?: boolean;
  sourceId?: SourceId;
  contribution?: string;
  className?: string;
}

/** Every displayed number must be wrapped in this: source + freshness + estimated flag. */
export function SourceLabel({
  source,
  freshness,
  isEstimated = false,
  contribution,
  className = '',
}: SourceLabelProps): JSX.Element {
  return (
    <span className={`source-label ${className} ${isEstimated ? 'is-estimated' : ''}`}>
      <span>Source: {source}</span>
      <span aria-hidden="true"> · </span>
      <span>{freshness}</span>
      {contribution ? <span className="sr-only"> — {contribution}</span> : null}
      {isEstimated ? <EstimatedBadge compact /> : null}
    </span>
  );
}
