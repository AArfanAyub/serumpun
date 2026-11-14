import type { JSX } from 'react';
import { DISCLAIMER } from '@/config/attribution';
import { useApp } from '@/state/AppContext';
import type { CropRecommendation, SiteConditions } from '@/types/domain';

/** Local-only field card: download JSON or print. No account, no cloud, no upload. */
export function FieldCardExport({
  site,
  recommendations,
}: {
  site: SiteConditions;
  recommendations: readonly CropRecommendation[];
}): JSX.Element {
  const { t } = useApp();

  function buildCard(): Record<string, unknown> {
    return {
      app: 'Serumpun',
      generatedOnDeviceAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
      location: site.location,
      targetMonth: site.targetMonth,
      dataStatus: site.appStatus,
      climatePeriod: site.climate.periodLabel,
      current: {
        temperatureC: site.current.temperatureC,
        humidityPct: site.current.humidityPct,
        precipitationMm: site.current.precipitationMm,
        observedAt: site.current.observedAt,
      },
      soil: {
        texture: site.soil.texture,
        ph: site.soil.ph,
        origin: site.soil.origin,
        isEstimated: site.soil.isEstimated,
      },
      profile: site.profile,
      provenance: site.provenance,
      recommendations: recommendations.map((rec) => ({
        rank: rec.rank,
        crop: rec.cropName,
        localName: rec.localName,
        score: rec.score,
        confidence: rec.confidence,
        verdict: rec.verdict,
        plantingWindow: rec.plantingWindow.status,
        rotation: rec.rotationPlan.seasons.map((season) => ({
          season: season.seasonIndex,
          crop: season.cropName,
          month: season.targetMonth,
          fitScore: season.fitScore,
        })),
      })),
    };
  }

  function download(): void {
    const card = buildCard();
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'serumpun-field-card.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="row">
      <button type="button" className="btn btn--secondary" onClick={download}>
        {t('common.download')}
      </button>
      <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
        {t('common.print')}
      </button>
    </div>
  );
}
