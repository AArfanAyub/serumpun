import type { JSX } from 'react';
import { CropCard } from '@/components/CropCard';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { Disclaimer } from '@/components/Disclaimer';
import { FieldCardExport } from '@/components/FieldCardExport';
import { MonthChips } from '@/components/Charts';
import { ATTRIBUTION } from '@/config/attribution';
import { FACTOR_ORDER, FACTOR_WEIGHTS } from '@/config/scoring';
import { monthName } from '@/domain/membership';
import { useApp } from '@/state/AppContext';

/** S4: "For <Month> at <Place>", 3–5 ranked cards, scoring-method link. */
export function S4Recommendations(): JSX.Element {
  const { state, actions, t } = useApp();
  const site = state.site;
  const recommendations = state.recommendations;

  if (!site || recommendations.length === 0) {
    return (
      <section className="screen">
        <h1>{t('rec.title', { month: monthName(site?.targetMonth ?? 1) })}</h1>
        <p>{t('common.notAvailable')}</p>
        <button type="button" className="btn" onClick={() => actions.goTo('S3_PROFILE')}>
          {t('profile.title')}
        </button>
      </section>
    );
  }

  const place = site.location.adminContext ?? site.location.placeName ?? t('find.unnamed');

  return (
    <section className="screen" aria-labelledby="rec-title">
      <div>
        <p className="eyebrow">S4</p>
        <h1 id="rec-title">{t('rec.title', { month: monthName(site.targetMonth) })}</h1>
        <p className="lead">{t('rec.at', { place })} — {t('rec.lead')}</p>
      </div>

      <div className="card">
        <MonthChips
          value={site.targetMonth}
          baseMonth={state.baseTargetMonth ?? site.targetMonth}
          onSelect={(month) => actions.setMonthOverride(month)}
          label={t('snapshot.monthOverride')}
        />
      </div>

      <div className="stack">
        {recommendations.map((recommendation) => (
          <CropCard key={recommendation.cropId} recommendation={recommendation} />
        ))}
      </div>

      <button
        type="button"
        className="link-button"
        aria-expanded={state.showScoringMethod}
        onClick={() => actions.toggleScoringMethod()}
      >
        {t('common.scoringMethod')}
      </button>

      {state.showScoringMethod ? (
        <div className="card stack">
          <h2>{t('rec.scoringTitle')}</h2>
          <p className="small" style={{ margin: 0 }}>{t('rec.scoringBody')}</p>
          <ul className="list-plain small">
            {FACTOR_ORDER.map((factorId) => (
              <li key={factorId} className="row row--between">
                <span>
                  <strong>{factorId}</strong> · {t(`factor.${factorId}`)}
                </span>
                <strong>{FACTOR_WEIGHTS[factorId]}</strong>
              </li>
            ))}
          </ul>
          <p className="tiny muted" style={{ margin: 0 }}>{ATTRIBUTION.CROPS}</p>
        </div>
      ) : null}

      <Disclaimer />
      <FieldCardExport site={site} recommendations={recommendations} />

      <div className="row">
        <button type="button" className="link-button" onClick={() => actions.goTo('S3_PROFILE')}>
          {t('profile.title')}
        </button>
        <button type="button" className="link-button" onClick={() => actions.goTo('S1_FIND_FIELD')}>
          {t('common.change')}
        </button>
        <DataSourcesLink />
      </div>
    </section>
  );
}
