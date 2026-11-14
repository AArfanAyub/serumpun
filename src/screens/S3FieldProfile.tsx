import { useState, type JSX } from 'react';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { Stepper } from '@/components/Stepper';
import { allCrops } from '@/domain/crops';
import { useApp } from '@/state/AppContext';
import type { FieldProfile, FarmerPriority, Irrigation, Shade, Slope, SoilTexture, SurroundingTag } from '@/types/domain';

interface Option<T extends string> {
  value: T;
  label: string;
}

function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  unknownLabel,
}: {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange(value: T): void;
  unknownLabel: string;
}): JSX.Element {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field-label">{legend}</legend>
      <div className="choice-group" role="group" aria-label={legend}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="choice"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="choice"
          aria-pressed={value === 'unknown'}
          onClick={() => onChange('unknown' as T)}
        >
          {unknownLabel}
        </button>
      </div>
    </fieldset>
  );
}

function deriveAnswered(profile: FieldProfile): FieldProfile['answered'] {
  return {
    soil: profile.soilTexture === 'unknown' && profile.soilPhOverride === null ? 'unknown' : 'answered',
    irrigation: profile.irrigation === 'unknown' ? 'unknown' : 'answered',
    slope: profile.slope === 'unknown' ? 'unknown' : 'answered',
    shade: profile.shade === 'unknown' ? 'unknown' : 'answered',
    previousCrop: profile.previousCropUnknown ? 'unknown' : 'answered',
    landSize: profile.landSizeHa === null ? 'unknown' : 'answered',
    surroundings:
      profile.surroundings.length === 0 || profile.surroundings.every((tag) => tag === 'none-known')
        ? 'unknown'
        : 'answered',
  };
}

/** S3: three short steps, "I don't know" on every question, SoilGrids prefill labelled. */
export function S3FieldProfile(): JSX.Element {
  const { state, actions, t } = useApp();
  const site = state.site;
  const prefillSoil = site?.soil.origin === 'soilgrids' && site.soil.texture !== 'unknown';

  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<FieldProfile>(() => {
    const base = { ...state.profile };
    if (prefillSoil && base.soilTexture === 'unknown' && site) {
      return {
        ...base,
        soilTexture: site.soil.texture,
        soilPhOverride: base.soilPhOverride ?? site.soil.ph,
      };
    }
    return base;
  });

  const [phText, setPhText] = useState(
    profile.soilPhOverride !== null ? String(profile.soilPhOverride) : ''
  );
  const [sizeText, setSizeText] = useState(
    profile.landSizeHa !== null ? String(profile.landSizeHa) : ''
  );

  function patch(partial: Partial<FieldProfile>): void {
    setProfile((current) => ({ ...current, ...partial }));
  }

  function submit(): void {
    const parsedPh = phText.trim() === '' ? null : Number(phText);
    const parsedSize = sizeText.trim() === '' ? null : Number(sizeText);
    const final: FieldProfile = {
      ...profile,
      soilPhOverride:
        parsedPh !== null && Number.isFinite(parsedPh) && parsedPh >= 4 && parsedPh <= 9
          ? Math.round(parsedPh * 10) / 10
          : null,
      landSizeHa:
        parsedSize !== null && Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : null,
      isSelfReported: profile.soilTexture !== 'unknown' || parsedPh !== null,
      answered: {},
    };
    final.answered = deriveAnswered(final);
    actions.setProfile(final);
  }

  const soilOptions: Option<SoilTexture>[] = [
    { value: 'sandy', label: t('profile.soilSandy') },
    { value: 'loam', label: t('profile.soilLoam') },
    { value: 'clay', label: t('profile.soilClay') },
    { value: 'peat', label: t('profile.soilPeat') },
  ];
  const irrigationOptions: Option<Irrigation>[] = [
    { value: 'none', label: t('profile.irrigationNone') },
    { value: 'partial', label: t('profile.irrigationPartial') },
    { value: 'reliable', label: t('profile.irrigationReliable') },
  ];
  const slopeOptions: Option<Slope>[] = [
    { value: 'flat', label: t('profile.slopeFlat') },
    { value: 'gentle', label: t('profile.slopeGentle') },
    { value: 'steep', label: t('profile.slopeSteep') },
  ];
  const shadeOptions: Option<Shade>[] = [
    { value: 'none', label: t('profile.shadeNone') },
    { value: 'partial', label: t('profile.shadePartial') },
    { value: 'heavy', label: t('profile.shadeHeavy') },
  ];
  const surroundOptions: Option<SurroundingTag>[] = [
    { value: 'nearby-water', label: t('profile.surroundWater') },
    { value: 'nearby-forest', label: t('profile.surroundForest') },
    { value: 'nearby-urban', label: t('profile.surroundUrban') },
    { value: 'none-known', label: t('profile.surroundNone') },
  ];
  const priorityOptions: Option<FarmerPriority>[] = (
    [
      'low-water',
      'drought-tolerance',
      'nitrogen-fixation',
      'erosion-reduction',
      'organic-matter',
      'forage',
      'quick-harvest',
      'market-suitability',
      'low-labour',
    ] as FarmerPriority[]
  ).map((value) => ({ value, label: t(`profile.priority.${value}`) }));

  function toggleTag(tag: SurroundingTag): void {
    const current = profile.surroundings.filter((item) => item !== 'none-known');
    if (tag === 'none-known') {
      patch({ surroundings: ['none-known'] });
      return;
    }
    const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
    patch({ surroundings: next.length === 0 ? ['none-known'] : next });
  }

  function togglePriority(priority: FarmerPriority): void {
    const current = profile.priorities;
    patch({
      priorities: current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority],
    });
  }

  return (
    <section className="screen" aria-labelledby="profile-title">
      <div>
        <p className="eyebrow">S3</p>
        <h1 id="profile-title">{t('profile.title')}</h1>
        <p className="lead">{t('profile.lead')}</p>
      </div>

      <Stepper
        step={step}
        labels={[t('profile.step1'), t('profile.step2'), t('profile.step3')]}
        onStep={setStep}
      />

      {prefillSoil ? (
        <p className="small" style={{ color: 'var(--poor)', margin: 0 }}>
          ◇ {t('profile.prefill')} {t('profile.estimatedLabel')}.
        </p>
      ) : null}

      {step === 1 ? (
        <div className="card stack">
          <h2>{t('profile.step1')}</h2>
          <ChoiceGroup
            legend={t('profile.soil')}
            options={soilOptions}
            value={profile.soilTexture}
            onChange={(value) => patch({ soilTexture: value })}
            unknownLabel={t('common.dontKnow')}
          />
          <span className="field-hint">{t('profile.soilHint')}</span>
          <label>
            <span className="field-label">{t('profile.ph')}</span>
            <input
              type="number"
              step="0.1"
              min="4"
              max="9"
              value={phText}
              onChange={(event) => setPhText(event.target.value)}
              placeholder={t('common.dontKnow')}
            />
            <span className="field-hint">{t('profile.phHint')}</span>
          </label>
          <button type="button" className="btn btn--block" onClick={() => setStep(2)}>
            {t('common.next')}
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="card stack">
          <h2>{t('profile.step2')}</h2>
          <ChoiceGroup
            legend={t('profile.irrigation')}
            options={irrigationOptions}
            value={profile.irrigation}
            onChange={(value) => patch({ irrigation: value })}
            unknownLabel={t('common.dontKnow')}
          />
          <ChoiceGroup
            legend={t('profile.slope')}
            options={slopeOptions}
            value={profile.slope}
            onChange={(value) => patch({ slope: value })}
            unknownLabel={t('common.dontKnow')}
          />
          <ChoiceGroup
            legend={t('profile.shade')}
            options={shadeOptions}
            value={profile.shade}
            onChange={(value) => patch({ shade: value })}
            unknownLabel={t('common.dontKnow')}
          />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label">{t('profile.surroundings')}</legend>
            <div className="choice-group">
              {surroundOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="choice"
                  aria-pressed={profile.surroundings.includes(option.value)}
                  onClick={() => toggleTag(option.value)}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                className="choice"
                aria-pressed={profile.surroundings.every((tag) => tag === 'none-known')}
                onClick={() => patch({ surroundings: ['none-known'] })}
              >
                {t('common.dontKnow')}
              </button>
            </div>
          </fieldset>
          <div className="row">
            <button type="button" className="btn btn--secondary" onClick={() => setStep(1)}>
              {t('common.back')}
            </button>
            <button type="button" className="btn" onClick={() => setStep(3)}>
              {t('common.next')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="card stack">
          <h2>{t('profile.step3')}</h2>
          <label>
            <span className="field-label">{t('profile.previousCrop')}</span>
            <select
              value={profile.previousCropId ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                patch({
                  previousCropId: value || null,
                  previousCropUnknown: value === '',
                });
              }}
            >
              <option value="">{t('profile.previousNone')}</option>
              {allCrops().map((crop) => (
                <option key={crop.cropId} value={crop.cropId}>
                  {crop.cropName}
                  {crop.localName ? ` (${crop.localName})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">{t('profile.landSize')}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={sizeText}
              onChange={(event) => setSizeText(event.target.value)}
              placeholder={t('common.dontKnow')}
            />
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label">{t('profile.priorities')}</legend>
            <div className="choice-group">
              {priorityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="choice"
                  aria-pressed={profile.priorities.includes(option.value)}
                  onClick={() => togglePriority(option.value)}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                className="choice"
                aria-pressed={profile.priorities.length === 0}
                onClick={() => patch({ priorities: [] })}
              >
                {t('common.dontKnow')}
              </button>
            </div>
          </fieldset>
          <div className="row">
            <button type="button" className="btn btn--secondary" onClick={() => setStep(2)}>
              {t('common.back')}
            </button>
            <button type="button" className="btn" onClick={submit}>
              {t('profile.seeCrops')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="row">
        <button type="button" className="link-button" onClick={() => actions.goTo('S2_SNAPSHOT')}>
          {t('common.back')}
        </button>
        <DataSourcesLink />
      </div>
    </section>
  );
}
