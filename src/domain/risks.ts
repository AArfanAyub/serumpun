import { WATER_DEMAND_MM } from '@/config/scoring';
import type { Provenance } from '@/types/data';
import type { CropDefinition, RiskNote, SiteConditions } from '@/types/domain';
import type { Lang } from '@/types/ui';
import { getCrop } from './crops';
import { riskText } from './explain';
import { daysInMonth, monthName, roundToInt } from './membership';

function prov(site: SiteConditions, sourceId: string): Provenance {
  return site.provenance.find((entry) => entry.sourceId === sourceId) ?? site.climate.provenance;
}

function note(
  type: RiskNote['type'],
  severity: RiskNote['severity'],
  plainText: string,
  provenance: Provenance
): RiskNote {
  return {
    type,
    severity,
    plainText,
    source: provenance.source,
    freshness: provenance.freshness,
  };
}

/** Threshold checks -> honest, plain-language risk notes, each with its triggering value. */
export function buildRiskNotes(
  site: SiteConditions,
  crop: CropDefinition,
  lang: Lang
): RiskNote[] {
  const mc = site.monthlyForTarget;
  const month = monthName(site.targetMonth);
  const climateProv = prov(site, 'NASA_POWER');
  const userProv = prov(site, 'USER');
  const rainPerDay = mc.precipMm / daysInMonth(site.targetMonth);
  const notes: RiskNote[] = [];

  const demand = WATER_DEMAND_MM[crop.waterNeed];
  if (mc.precipMm < 0.6 * demand) {
    notes.push(
      note(
        'drought',
        mc.precipMm < 0.35 * demand ? 'high' : 'medium',
        riskText(lang, 'drought', { month, rain: roundToInt(mc.precipMm), crop: crop.cropName }),
        climateProv
      )
    );
  }

  if (mc.t2mMaxC > crop.requirements.heatStressC) {
    notes.push(
      note(
        'heat',
        mc.t2mMaxC > crop.requirements.heatStressC + 4 ? 'high' : 'medium',
        riskText(lang, 'heat', { value: roundToInt(mc.t2mMaxC), crop: crop.cropName }),
        climateProv
      )
    );
  }

  if (rainPerDay > crop.requirements.heavyRainMmDay) {
    notes.push(
      note(
        'heavy rain',
        rainPerDay > crop.requirements.heavyRainMmDay * 1.6 ? 'high' : 'medium',
        riskText(lang, 'heavy rain', { value: roundToInt(rainPerDay) }),
        climateProv
      )
    );
    if (site.profile.slope === 'steep') {
      notes.push(note('erosion', 'high', riskText(lang, 'erosion', {}), userProv));
    }
  }

  if (!crop.requirements.frostTolerant && mc.t2mMinC < 5) {
    notes.push(
      note(
        'frost',
        mc.t2mMinC < 0 ? 'high' : 'medium',
        riskText(lang, 'frost', { value: roundToInt(mc.t2mMinC), crop: crop.cropName }),
        climateProv
      )
    );
  }

  const prev = site.profile.previousCropUnknown ? null : getCrop(site.profile.previousCropId);
  if (prev && (prev.family === crop.family || prev.diseaseGroups.some((g) => crop.diseaseGroups.includes(g)))) {
    notes.push(
      note(
        'pest-rotation',
        'high',
        riskText(lang, 'pest-rotation', { prev: prev.cropName, crop: crop.cropName }),
        userProv
      )
    );
  }

  return notes;
}
