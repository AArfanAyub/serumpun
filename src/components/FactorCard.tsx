import type { JSX } from 'react';
import type { FactorScore } from '@/types/domain';
import { useApp } from '@/state/AppContext';
import { SourceLabel } from './SourceLabel';
import { VerdictChip } from './VerdictChip';

/** One FactorScore -> value / verdict / reason / source / freshness (Databricks card pattern). */
export function FactorCard({ factor }: { factor: FactorScore }): JSX.Element {
  const { t } = useApp();
  const fillClass =
    factor.verdict === 'Good'
      ? 'factor-bar__fill'
      : factor.verdict === 'Fair'
        ? 'factor-bar__fill factor-bar__fill--fair'
        : 'factor-bar__fill factor-bar__fill--poor';
  return (
    <article className="card stack" aria-label={`${factor.name}: ${factor.observedValue}`}>
      <div className="row row--between">
        <strong>{factor.name}</strong>
        <span className="small muted">{t('why.weight', { weight: factor.weight })}</span>
      </div>
      <div className="row row--between">
        <span className="kpi__value">{factor.observedValue}</span>
        <VerdictChip verdict={factor.verdict} />
      </div>
      <div
        className="factor-bar"
        role="meter"
        aria-valuenow={factor.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${factor.name} sub-score ${factor.score} out of 100`}
      >
        <div className={fillClass} style={{ width: `${factor.score}%` }} />
      </div>
      <p className="small" style={{ margin: 0 }}>
        {factor.reason}
      </p>
      <SourceLabel
        source={factor.source}
        freshness={factor.freshness}
        isEstimated={factor.isEstimated}
        sourceId={factor.sourceId}
      />
    </article>
  );
}
