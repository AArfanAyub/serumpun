import type { ResolvedLocation } from '@/api/orchestrator';
import { defaultProfile } from '@/normalize/merge';
import type { LocationInput } from '@/types/data';
import type { CropRecommendation, FieldLocation, FieldProfile, SiteConditions } from '@/types/domain';
import type { Lang, Month, Screen } from '@/types/ui';
import { loadPersisted } from './persist';

export interface AppState {
  screen: Screen;
  lang: Lang;
  location: FieldLocation | null;
  site: SiteConditions | null;
  resolved: ResolvedLocation | null;
  profile: FieldProfile;
  recommendations: CropRecommendation[];
  selectedCropId: string | null;
  selectedStrategyId: string | null;
  monthOverride: Month | null;
  baseTargetMonth: Month | null;
  showScoringMethod: boolean;
  loading: boolean;
  loadingLabel: string;
  notice: string | null;
  forcedOffline: boolean;
  lastInput: LocationInput | null;
  dataSourcesReturnScreen: Screen;
}

export type AppAction =
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'GO_TO'; screen: Screen }
  | { type: 'SET_LOADING'; loading: boolean; label?: string }
  | { type: 'SET_NOTICE'; note: string | null }
  | { type: 'SET_RESOLVED'; resolved: ResolvedLocation; input: LocationInput }
  | {
      type: 'SET_SITE';
      site: SiteConditions;
      recommendations: CropRecommendation[];
      location: FieldLocation;
    }
  | {
      type: 'SET_PROFILE';
      profile: FieldProfile;
      site: SiteConditions;
      recommendations: CropRecommendation[];
    }
  | { type: 'SELECT_CROP'; cropId: string | null }
  | { type: 'SELECT_STRATEGY'; strategyId: string | null }
  | {
      type: 'SET_MONTH_OVERRIDE';
      month: Month | null;
      site: SiteConditions;
      recommendations: CropRecommendation[];
    }
  | { type: 'TOGGLE_SCORING_METHOD'; value?: boolean }
  | { type: 'SET_OFFLINE'; forcedOffline: boolean }
  | { type: 'RESET' };

export const initialState: AppState = {
  screen: 'S0_WELCOME',
  lang: 'en',
  location: null,
  site: null,
  resolved: null,
  profile: defaultProfile(),
  recommendations: [],
  selectedCropId: null,
  selectedStrategyId: null,
  monthOverride: null,
  baseTargetMonth: null,
  showScoringMethod: false,
  loading: false,
  loadingLabel: '',
  notice: null,
  forcedOffline: false,
  lastInput: null,
  dataSourcesReturnScreen: 'S2_SNAPSHOT',
};

/** Factory that restores only local, non-sensitive preferences. Never fetches. */
export function createInitialState(): AppState {
  const persisted = loadPersisted();
  return {
    ...initialState,
    lang: persisted.lang,
    profile: persisted.profile,
    monthOverride: persisted.targetMonth,
  };
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang };
    case 'GO_TO':
      return {
        ...state,
        screen: action.screen,
        dataSourcesReturnScreen:
          action.screen === 'S7_DATA_SOURCES' ? state.screen : state.dataSourcesReturnScreen,
        notice: action.screen === state.screen ? state.notice : state.notice,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.loading, loadingLabel: action.label ?? '' };
    case 'SET_NOTICE':
      return { ...state, notice: action.note };
    case 'SET_RESOLVED':
      return { ...state, resolved: action.resolved, lastInput: action.input, notice: action.resolved.note };
    case 'SET_SITE':
      return {
        ...state,
        site: action.site,
        location: action.location,
        recommendations: action.recommendations,
        loading: false,
        loadingLabel: '',
        baseTargetMonth: action.site.targetMonth,
        monthOverride: null,
        selectedCropId: action.recommendations[0]?.cropId ?? null,
        screen: 'S2_SNAPSHOT',
      };
    case 'SET_PROFILE':
      return {
        ...state,
        profile: action.profile,
        site: action.site,
        recommendations: action.recommendations,
        selectedCropId: action.recommendations[0]?.cropId ?? null,
        screen: 'S4_RECOMMENDATIONS',
      };
    case 'SELECT_CROP':
      return { ...state, selectedCropId: action.cropId };
    case 'SELECT_STRATEGY':
      return { ...state, selectedStrategyId: action.strategyId };
    case 'SET_MONTH_OVERRIDE':
      return {
        ...state,
        monthOverride: action.month,
        site: action.site,
        recommendations: action.recommendations,
        selectedCropId: action.recommendations[0]?.cropId ?? null,
      };
    case 'TOGGLE_SCORING_METHOD':
      return { ...state, showScoringMethod: action.value ?? !state.showScoringMethod };
    case 'SET_OFFLINE':
      return { ...state, forcedOffline: action.forcedOffline };
    case 'RESET':
      return {
        ...initialState,
        lang: state.lang,
        profile: defaultProfile(),
        notice: null,
      };
    default:
      return state;
  }
}
