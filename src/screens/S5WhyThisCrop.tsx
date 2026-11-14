import type { JSX } from 'react';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { Disclaimer } from '@/components/Disclaimer';
import { FactorCard } from '@/components/FactorCard';
import { RiskNote } from '@/components/RiskNote';
import { ScoreRing } from '@/components/ScoreRing';
import { windowStatusLabel } from '@/domain/explain';
import { useApp } from '@/state/AppContext';

/** S5: big score ring + "What does this mean?" + factor breakdown + risks + single CTA. */
export function S5WhyThisCrop(): JSX.Element {
  const { state, actions, t } = useApp();
  const recommendation =
    state.recommendations.find((item) => item.cropId === state.selectedCropId) ??
    state.recommendations[0];

  if (!recommendation) {
    return (
      <section className="screen">
        <h1>{t('why.title', { crop: '—' })}</h1>
        <p>{t('common.notAvailable')}</p>
        <button type="button" className="btn" onClick={() => actions.goTo('S4_RECOMMENDATIONS')}>
          {t('why.backToList')}
        </button>
      </section>
    );
  }

  const windowLabel = windowStatusLabel(state.lang, recommendation.plantingWindow);

  return (
    <section className="screen" aria-labelledby="why-title">
      <div>
        <p className="eyebrow">S5</p>
        <h1 id="why-title">{t('why.title', { crop: recommendation.cropName })}</h1>
        {recommendation.localName ? <p className="muted">{recommendation.localName}</p> : null}
      </div>

      <div className="card">
        <div className="score-ring-wrap">
          <ScoreRing score={recommendation.score} label={recommendation.verdict} />
          <div className="stack" style={{ flex: 1, minWidth: 200 }}>
            <strong className="lead" style={{ margin: 0 }}>{recommendation.verdict}</strong>
            <span className="badge badge--estimated">
              <span aria-hidden="true">◇</span> {t('why.confidenceLabel')}: {t(`confidence.${recommendation.confidence}`)}
            </span>
            <p className="small muted" style={{ margin: 0 }}>{recommendation.confidenceReason}</p>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2>{t('common.whatThisMeans')}</h2>
        <p className="lead" style={{ margin: 0 }}>{recommendation.whatThisMeans}</p>
      </div>

      <div className="card stack">
        <h2>{t('why.window')}</h2>
        <p style={{ margin: 0 }}><span className="badge">{windowLabel}</span></p>
        <p className="small muted" style={{ margin: 0 }}>{recommendation.plantingWindow.note}</p>
      </div>

      <div>
        <h2>{t('why.factors')}</h2>
        <p className="small muted">{t('why.factorsLead')}</p>
        <div className="grid-2">
          {recommendation.factorBreakdown.map((factor) => (
            <FactorCard key={factor.factorId} factor={factor} />
          ))}
        </div>
      </div>

      <div className="stack">
        <h2>{t('why.risks')}</h2>
        {recommendation.riskNotes.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>{t('why.noRisks')}</p>
        ) : (
          recommendation.riskNotes.map((note, index) => (
            <RiskNote key={`${note.type}-${index}`} note={note} />
          ))
        )}
      </div>

      <div className="card stack">
        <div className="row row--between">
          <strong>{t('why.water')}</strong>
          <span>{recommendation.waterNeed} — {recommendation.waterNeedNote}</span>
        </div>
        <hr className="divider" />
        <div className="row row--between">
          <strong>{t('why.days')}</strong>
          <span>
            {recommendation.daysToHarvest.min}–{recommendation.daysToHarvest.max} {t('why.daysNote')}
          </span>
        </div>
        <hr className="divider" />
        <div className="row row--between">
          <strong>{t('why.difficulty')}</strong>
          <span>{recommendation.difficulty} — {recommendation.difficultyReason}</span>
        </div>
      </div>

      <Disclaimer />

      <button type="button" className="btn btn--block" onClick={() => actions.goTo('S6_ROTATION')}>
        {t('why.rotationCta')}
      </button>
      <div className="row">
        <button type="button" className="link-button" onClick={() => actions.goTo('S4_RECOMMENDATIONS')}>
          {t('why.backToList')}
        </button>
        <DataSourcesLink />
      </div>
    </section>
  );
}
