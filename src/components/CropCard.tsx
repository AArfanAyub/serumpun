import type { JSX } from 'react';
import { windowStatusLabel } from '@/domain/explain';
import { useApp } from '@/state/AppContext';
import type { CropRecommendation } from '@/types/domain';

/** Ranked crop card: score, verdict, window chip, "Why?" (Yuka pattern). */
export function CropCard({ recommendation }: { recommendation: CropRecommendation }): JSX.Element {
  const { state, actions, t } = useApp();
  const windowLabel = windowStatusLabel(state.lang, recommendation.plantingWindow);
  const verdictKey =
    recommendation.verdict === 'Good fit'
      ? 'common.verdictGood'
      : recommendation.verdict === 'Worth considering'
        ? 'common.verdictFair'
        : 'common.verdictPoor';
  return (
    <button
      type="button"
      className="crop-card"
      onClick={() => actions.selectCrop(recommendation.cropId)}
      aria-label={`${recommendation.cropName}, score ${recommendation.score} out of 100. ${windowLabel}. ${t('rec.tapWhy')}`}
    >
      <div className="crop-card__top">
        <div className="row">
          <span className="crop-card__rank" aria-hidden="true">
            {recommendation.rank}
          </span>
          <div>
            <h3 style={{ margin: 0 }}>{recommendation.cropName}</h3>
            {recommendation.localName ? (
              <span className="small muted">{recommendation.localName}</span>
            ) : null}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="crop-card__score">{recommendation.score}</span>
          <span className="small muted"> / 100</span>
        </div>
      </div>
      <div className="chip-row" style={{ marginTop: 12 }}>
        <span className="verdict-chip verdict-chip--good">
          <span aria-hidden="true">✓</span> {t(verdictKey)} · {recommendation.verdict}
        </span>
        <span className="badge">{windowLabel}</span>
        <span className="badge badge--estimated">
          <span aria-hidden="true">◇</span> {t('common.confidence')}: {recommendation.confidence}
        </span>
      </div>
      <p className="small muted" style={{ margin: '12px 0 0' }}>
        {t('rec.tapWhy')} →
      </p>
    </button>
  );
}
