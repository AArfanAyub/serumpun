import type { JSX } from 'react';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { Disclaimer } from '@/components/Disclaimer';
import { NO_MATCH_NOTE } from '@/config/attribution';
import { monthName } from '@/domain/membership';
import { useApp } from '@/state/AppContext';

/** S6: 3-season timeline with a plain-language reason on every transition. */
export function S6RotationPlan(): JSX.Element {
  const { state, actions, t } = useApp();
  const recommendation =
    state.recommendations.find((item) => item.cropId === state.selectedCropId) ??
    state.recommendations[0];

  if (!recommendation) {
    return (
      <section className="screen">
        <h1>{t('rotation.title')}</h1>
        <p>{t('common.notAvailable')}</p>
        <button type="button" className="btn" onClick={() => actions.goTo('S4_RECOMMENDATIONS')}>
          {t('why.backToList')}
        </button>
      </section>
    );
  }

  const plan = recommendation.rotationPlan;

  return (
    <section className="screen" aria-labelledby="rotation-title">
      <div>
        <p className="eyebrow">S6</p>
        <h1 id="rotation-title">{t('rotation.title')}</h1>
        <p className="lead">{t('rotation.lead')}</p>
        <p className="small muted" style={{ margin: 0 }}>
          {t('rotation.previous')}: {plan.previousCrop.assumedNeutral ? t('rotation.assumedNeutralShort') : plan.previousCrop.note}
        </p>
      </div>

      {plan.noConfidentMatch ? (
        <div className="risk-note" role="alert">
          <strong>{t('rotation.noMatch')}</strong> — {NO_MATCH_NOTE}
          {plan.noMatchNote ? <div className="small">{plan.noMatchNote}</div> : null}
        </div>
      ) : null}

      <div className="timeline">
        {plan.seasons.map((season, index) => (
          <div key={season.seasonIndex}>
            {index > 0 ? (
              <div className="timeline__arrow">
                <strong>{t('rotation.transitionLabel')}:</strong> {plan.transitionReasons[index]}
              </div>
            ) : (
              <div className="timeline__arrow">
                <strong>{t('rotation.transitionLabel')}:</strong> {plan.transitionReasons[0]}
              </div>
            )}
            <article
              className={`card stack season-card ${season.tentative ? 'season-card--tentative' : ''}`}
              aria-label={`${season.periodLabel}: ${season.cropName}`}
            >
              <div className="row row--between">
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>{season.periodLabel}</p>
                  <h2 style={{ margin: 0 }}>{season.cropName}</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="crop-card__score">{season.fitScore}</span>
                  <span className="small muted"> / 100</span>
                  <div className="small muted">{t('rotation.fit')} · {monthName(season.targetMonth)}</div>
                </div>
              </div>

              <div className="chip-row">
                <span className="tag">{t('label.family')}: {season.family}</span>
                <span className="tag">{t('label.nitrogen')}: {season.nitrogenRole}</span>
                <span className="tag">{t('label.root')}: {season.rootDepth}</span>
                <span className="tag tag--amber">
                  {t('common.confidence')}: {season.confidence}
                </span>
              </div>

              <div>
                <strong className="small">{t('rotation.reasons')}</strong>
                <ul className="bullet-list small" style={{ marginTop: 4 }}>
                  {season.reasons.map((reason, reasonIndex) => (
                    <li key={`${season.seasonIndex}-reason-${reasonIndex}`}>{reason}</li>
                  ))}
                </ul>
              </div>

              {season.cautions.length > 0 ? (
                <div>
                  <strong className="small">{t('rotation.cautions')}</strong>
                  <ul className="bullet-list small" style={{ marginTop: 4 }}>
                    {season.cautions.map((caution, cautionIndex) => (
                      <li key={`${season.seasonIndex}-caution-${cautionIndex}`}>{caution}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {season.tentativeNotice ? <p className="caveat" style={{ margin: 0 }}>{season.tentativeNotice}</p> : null}
            </article>
          </div>
        ))}
      </div>

      <Disclaimer />

      <button type="button" className="btn btn--block" onClick={() => actions.goTo('S6_STRATEGY_COMPARE')}>
        {t('rotation.strategyCta')}
      </button>
      <div className="row">
        <button type="button" className="link-button" onClick={() => actions.goTo('S5_WHY')}>
          {t('why.title', { crop: recommendation.cropName })}
        </button>
        <DataSourcesLink />
      </div>
    </section>
  );
}
