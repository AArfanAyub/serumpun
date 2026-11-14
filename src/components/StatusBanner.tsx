import type { JSX } from 'react';
import { useApp } from '@/state/AppContext';
import type { AppDataStatus } from '@/types/data';
import { DataSourcesLink } from './DataSourcesLink';

const CLASS: Record<AppDataStatus, string> = {
  Live: 'status-banner',
  'Partly estimated': 'status-banner is-partly',
  'Offline sample': 'status-banner is-offline',
};

const LABEL_KEY: Record<AppDataStatus, string> = {
  Live: 'banner.live',
  'Partly estimated': 'banner.partly',
  'Offline sample': 'banner.offline',
};

const NOTE_KEY: Record<AppDataStatus, string> = {
  Live: 'banner.liveNote',
  'Partly estimated': 'banner.partlyNote',
  'Offline sample': 'banner.offlineNote',
};

/** Persistent, non-blocking Live / Partly estimated / Offline sample banner. */
export function StatusBanner(): JSX.Element {
  const { state, actions, t } = useApp();
  const status: AppDataStatus = state.site?.appStatus ?? 'Offline sample';
  return (
    <div className={CLASS[status]} role="status" aria-live="polite">
      <div className="status-banner__left">
        <span className="status-dot" aria-hidden="true" />
        <span>{t(LABEL_KEY[status])}</span>
        <span className="muted small">— {t(NOTE_KEY[status])}</span>
      </div>
      <div className="status-banner__actions">
        <button
          type="button"
          className="link-button"
          onClick={() => {
            void actions.retry();
          }}
          disabled={state.loading}
        >
          {t('common.tryAgain')}
        </button>
        <DataSourcesLink />
      </div>
    </div>
  );
}
