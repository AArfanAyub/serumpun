import type { JSX } from 'react';
import { useApp } from '@/state/AppContext';

/** One tap from any data-bearing screen to S7. */
export function DataSourcesLink({ label }: { label?: string }): JSX.Element {
  const { actions, t } = useApp();
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => actions.goTo('S7_DATA_SOURCES')}
      aria-label={t('common.dataSources')}
    >
      {label ?? t('common.dataSources')}
    </button>
  );
}
