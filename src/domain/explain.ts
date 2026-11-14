import { t, type TParams } from '@/i18n';
import { addMonths, monthName, monthShort } from './membership';
import type { CropDefinition, PlantingWindow } from '@/types/domain';
import type { ConfidenceLevel, CropVerdict, Lang, Month, Verdict } from '@/types/ui';

export function factorName(lang: Lang, factorId: string): string {
  return t(lang, `factor.${factorId}`);
}

/** Lowercase verdict word used inside a sentence. */
export function verdictWord(lang: Lang, verdict: Verdict): string {
  return t(lang, `verdict.${verdict}`);
}

/** Capitalised verdict word used on a chip (icon + word, never colour alone). */
export function verdictLabel(lang: Lang, verdict: Verdict): string {
  const key = verdict === 'Good' ? 'common.verdictGood' : verdict === 'Fair' ? 'common.verdictFair' : 'common.verdictPoor';
  return t(lang, key);
}

export function cropVerdictLabel(lang: Lang, verdict: CropVerdict): string {
  return t(lang, `cropVerdict.${verdict}`);
}

export function confidenceLabel(lang: Lang, level: ConfidenceLevel): string {
  return t(lang, `confidence.${level}`);
}

export interface F1ReasonParams {
  month: string;
  temp: number;
  optMin: number;
  optMax: number;
  verdict: string;
  heat: number | null;
  frost: number | null;
}

export function f1Reason(lang: Lang, p: F1ReasonParams): string {
  let text = t(lang, 'f1.reason', p);
  if (p.heat !== null) text += ` ${t(lang, 'f1.heat', { value: p.heat })}`;
  if (p.frost !== null) text += ` ${t(lang, 'f1.frost', { value: p.frost })}`;
  return text;
}

export function f2Reason(lang: Lang, p: TParams): string {
  return t(lang, 'f2.reason', p);
}

export function f3Reason(lang: Lang, p: TParams): string {
  return t(lang, 'f3.reason', p);
}

export function f4Reason(lang: Lang, p: TParams): string {
  return t(lang, 'f4.reason', p);
}

export function f5Reason(lang: Lang, p: TParams): string {
  return t(lang, 'f5.reason', p);
}

export function f6Reason(lang: Lang, p: TParams): string {
  return t(lang, 'f6.reason', p);
}

export function f7Reason(lang: Lang, p: TParams): string {
  return t(lang, 'f7.reason', p);
}

export function f4Position(lang: Lang, position: 'in' | 'before' | 'out'): string {
  return t(lang, `f4.position.${position}`);
}

/** Build the PlantingWindow object from the F4 score and the crop's window. */
export function plantingWindowFromScore(
  lang: Lang,
  crop: CropDefinition,
  targetMonth: Month,
  f4Score: number
): PlantingWindow {
  const { startMonth, endMonth, bestMonth } = crop.plantingWindow;
  let status: PlantingWindow['status'];
  if (f4Score >= 85) status = 'Plant now';
  else if (f4Score === 55) status = 'Wait until <Month>';
  else status = 'Out of season';

  const note =
    status === 'Plant now'
      ? t(lang, 'window.note.now', { month: monthName(targetMonth), best: monthName(bestMonth) })
      : status === 'Wait until <Month>'
        ? t(lang, 'window.note.wait', { best: monthName(bestMonth) })
        : t(lang, 'window.note.out', {
            start: monthShort(startMonth),
            end: monthShort(endMonth),
          });

  return { status, startMonth, endMonth, bestMonth, note };
}

export function windowStatusLabel(lang: Lang, window: PlantingWindow): string {
  if (window.status === 'Wait until <Month>') {
    return t(lang, 'window.Wait until <Month>', { month: monthName(window.bestMonth) });
  }
  return t(lang, `window.${window.status}`);
}

export function whatThisMeans(
  lang: Lang,
  p: { crop: string; score: number; month: string; verdict: string; waterSentence: string }
): string {
  return t(lang, 'whatThisMeans', p);
}

export function confidenceReason(lang: Lang, level: ConfidenceLevel, triggers: string[]): string {
  const levelWord = confidenceLabel(lang, level);
  if (triggers.length === 0) {
    return t(lang, 'confidence.reason.none');
  }
  return t(lang, 'confidence.prefix', { level: levelWord, reasons: triggers.join(', ') });
}

export function riskText(lang: Lang, type: string, params: TParams): string {
  const keys: Record<string, string> = {
    drought: 'risk.drought',
    heat: 'risk.heat',
    'heavy rain': 'risk.heavyRain',
    erosion: 'risk.erosion',
    frost: 'risk.frost',
    'pest-rotation': 'risk.pestRotation',
  };
  return t(lang, keys[type] ?? 'risk.drought', params);
}

/** One plain-language reason per transition, naming the rules it satisfies (PRD 6.3 tone). */
export function transitionReason(
  lang: Lang,
  from: string,
  to: string,
  rules: string[],
  neutralNote = false
): string {
  const ruleText = rules.length > 0 ? rules.join('; ') : t(lang, 'rotation.rule.season');
  const sentence = t(lang, 'rotation.transition', { from, to, rules: ruleText });
  return neutralNote ? `${sentence} ${t(lang, 'rotation.neutral')}` : sentence;
}

export function rotationRule(lang: Lang, rule: string): string {
  const keys: Record<string, string> = {
    family: 'rotation.rule.family',
    nitrogen: 'rotation.rule.nitrogen',
    root: 'rotation.rule.root',
    disease: 'rotation.rule.disease',
    season: 'rotation.rule.season',
    sameFamily: 'rotation.rule.sameFamily',
  };
  return t(lang, keys[rule] ?? 'rotation.rule.season');
}

export function cautionText(lang: Lang, key: string, params: TParams = {}): string {
  const keys: Record<string, string> = {
    disease2: 'rotation.caution.disease2',
    fit: 'rotation.caution.fit',
    window: 'rotation.caution.window',
    mediumRoot: 'rotation.caution.mediumRoot',
    c1Window: 'rotation.caution.c1Window',
  };
  return t(lang, keys[key] ?? key, params);
}

export function seasonPeriodLabel(lang: Lang, index: 1 | 2 | 3, month: Month): string {
  if (index === 1) return t(lang, 'rotation.now');
  return t(lang, 'rotation.future', {
    index,
    from: monthShort(month),
    to: monthShort(addMonths(month, 3)),
  });
}

export function labelWord(lang: Lang, key: string): string {
  return t(lang, `label.${key}`);
}
