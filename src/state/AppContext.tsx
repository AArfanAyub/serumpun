import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type JSX,
  type ReactNode,
} from 'react';
import { fetchSite, offlineSite, resolveLocation } from '@/api/orchestrator';
import { recommend } from '@/domain/recommend';
import { makeT } from '@/i18n';
import { remergeSite } from '@/normalize/merge';
import type { LocationInput } from '@/types/data';
import type { FieldProfile, SiteConditions } from '@/types/domain';
import type { Lang, Month, Screen } from '@/types/ui';
import { clearPersisted, savePersisted } from './persist';
import { createInitialState, reducer, type AppAction, type AppState } from './reducer';

export interface AppActions {
  goTo(screen: Screen): void;
  setLang(lang: Lang): void;
  startLocation(input: LocationInput): Promise<void>;
  retry(): Promise<void>;
  setProfile(profile: FieldProfile): void;
  selectCrop(cropId: string): void;
  selectStrategy(strategyId: string | null): void;
  setMonthOverride(month: Month | null): void;
  toggleScoringMethod(value?: boolean): void;
  reset(): void;
}

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  actions: AppActions;
  t: (key: string, params?: object) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

function persistFrom(state: AppState): void {
  savePersisted({
    location: state.location,
    profile: state.profile,
    lang: state.lang,
    targetMonth: state.monthOverride,
    lastGoodAt: new Date().toISOString(),
  });
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  const goTo = useCallback((screen: Screen) => {
    dispatch({ type: 'GO_TO', screen });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const runLocation = useCallback(async (input: LocationInput): Promise<void> => {
    const current = stateRef.current;
    dispatch({ type: 'SET_LOADING', loading: true, label: 'Loading your field data…' });
    try {
      const resolved = await resolveLocation(input);
      dispatch({ type: 'SET_RESOLVED', resolved, input });

      const forcedOffline =
        input.kind === 'sample' || current.forcedOffline || current.lastInput?.kind === 'sample';
      dispatch({ type: 'SET_OFFLINE', forcedOffline });

      const site = await fetchSite(resolved.location, {
        forcedOffline,
        locationExtras: {
          provenance: resolved.provenance,
          statuses: resolved.statuses,
        },
        profile: current.profile,
        targetMonth: current.monthOverride ?? undefined,
      });
      const recommendations = recommend(site, current.lang);
      dispatch({ type: 'SET_SITE', site, recommendations, location: resolved.location });
      persistFrom({
        ...stateRef.current,
        location: resolved.location,
        profile: current.profile,
        lang: current.lang,
      });
    } catch {
      // The api layer never throws across its boundary; this is a last-resort guard so
      // the farmer is NEVER left on a spinner or a blank screen.
      const site = offlineSite(undefined, current.profile, current.monthOverride ?? undefined);
      const recommendations = recommend(site, current.lang);
      dispatch({
        type: 'SET_SITE',
        site,
        recommendations,
        location: site.location,
      });
      dispatch({
        type: 'SET_NOTICE',
        note: 'Live data could not be loaded, so bundled sample data is being used.',
      });
    }
  }, []);

  const startLocation = useCallback(
    async (input: LocationInput): Promise<void> => {
      await runLocation(input);
    },
    [runLocation]
  );

  const retry = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    const input: LocationInput = current.lastInput ?? { kind: 'sample' };
    dispatch({ type: 'SET_OFFLINE', forcedOffline: input.kind === 'sample' });
    await runLocation(input);
  }, [runLocation]);

  const setLang = useCallback((lang: Lang): void => {
    dispatch({ type: 'SET_LANG', lang });
    const current = stateRef.current;
    if (current.site) {
      const recommendations = recommend(current.site, lang);
      dispatch({
        type: 'SET_PROFILE',
        profile: current.profile,
        site: current.site,
        recommendations,
      });
      // Keep the user on the screen they were on; SET_PROFILE navigates to S4.
      dispatch({ type: 'GO_TO', screen: current.screen });
    }
    persistFrom({ ...current, lang });
  }, []);

  const setProfile = useCallback((profile: FieldProfile): void => {
    const current = stateRef.current;
    if (!current.site) {
      dispatch({ type: 'SET_PROFILE', profile, site: offlineSite(), recommendations: [] });
      return;
    }
    const site = remergeSite(current.site, {
      profile,
      targetMonth: current.monthOverride ?? current.baseTargetMonth ?? undefined,
    });
    const recommendations = recommend(site, current.lang);
    dispatch({ type: 'SET_PROFILE', profile, site, recommendations });
    persistFrom({ ...current, profile });
  }, []);

  const selectCrop = useCallback(
    (cropId: string): void => {
      dispatch({ type: 'SELECT_CROP', cropId });
      goTo('S5_WHY');
    },
    [goTo]
  );

  const selectStrategy = useCallback((strategyId: string | null): void => {
    dispatch({ type: 'SELECT_STRATEGY', strategyId });
  }, []);

  const setMonthOverride = useCallback((month: Month | null): void => {
    const current = stateRef.current;
    if (!current.site) return;
    const targetMonth = month ?? current.baseTargetMonth ?? current.site.targetMonth;
    const site: SiteConditions = remergeSite(current.site, { targetMonth });
    const recommendations = recommend(site, current.lang);
    dispatch({ type: 'SET_MONTH_OVERRIDE', month, site, recommendations });
    persistFrom({ ...current, monthOverride: month });
  }, []);

  const toggleScoringMethod = useCallback((value?: boolean): void => {
    dispatch({ type: 'TOGGLE_SCORING_METHOD', value });
  }, []);

  const reset = useCallback((): void => {
    clearPersisted();
    dispatch({ type: 'RESET' });
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      goTo,
      setLang,
      startLocation,
      retry,
      setProfile,
      selectCrop,
      selectStrategy,
      setMonthOverride,
      toggleScoringMethod,
      reset,
    }),
    [
      goTo,
      setLang,
      startLocation,
      retry,
      setProfile,
      selectCrop,
      selectStrategy,
      setMonthOverride,
      toggleScoringMethod,
      reset,
    ]
  );

  const translate = useMemo(() => makeT(state.lang), [state.lang]);

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, actions, t: translate }),
    [state, actions, translate]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
