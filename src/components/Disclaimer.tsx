import type { JSX } from 'react';
import { DISCLAIMER, REGIONAL_ESTIMATE_CAVEAT } from '@/config/attribution';
import { useApp } from '@/state/AppContext';

/** Fixed US-11 notice + grid-scale caveat. Always visible near a score or rotation. */
export function Disclaimer({ showCaveat = true }: { showCaveat?: boolean }): JSX.Element {
  const { t } = useApp();
  return (
    <div className="stack" role="note">
      <div className="disclaimer">
        <strong>{t('common.disclaimerTitle')}:</strong> {DISCLAIMER}
      </div>
      {showCaveat ? <p className="caveat">{REGIONAL_ESTIMATE_CAVEAT}</p> : null}
    </div>
  );
}
