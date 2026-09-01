import type {
	AppStateAction,
	NavigationStatePatch,
	NormalizedUiSettingsPatch,
	SyncEvent,
} from "./appStateActions.ts";
import type {
	DiceAction,
	DiceRollRequest,
	PublishedDiceResult,
} from "./diceActions.ts";
import type {
	ActiveMentionPickerRequest,
	MentionPickerAction,
} from "./mentionPickerActions.ts";
import type {
	MessageBoxAction,
	MessageBoxPayload,
} from "./messageBoxActions.ts";
import type { ModalAction, ModalConfig } from "./modalActions.ts";
import type {
	RulesReferenceAction,
	RulesReferenceHistoryEntry,
	RulesReferenceNavigationRequest,
} from "./rulesReferenceActions.ts";
import type { RequestId } from "./contracts.ts";

export type AppAction =
	| AppStateAction
	| DiceAction
	| MentionPickerAction
	| MessageBoxAction
	| ModalAction
	| RulesReferenceAction;

export type UiSettingsState = Required<NormalizedUiSettingsPatch>;

export interface AppState {
	modal: {
		requestId: RequestId | null;
		config: ModalConfig | null;
	};
	entityRefreshVersion: number;
	mentionPickerRequest: ActiveMentionPickerRequest | null;
	dice: {
		rollRequest: DiceRollRequest | null;
		rolledResult: PublishedDiceResult | null;
	};
	messageBox: MessageBoxPayload | null;
	navigation: Required<NavigationStatePatch>;
	active: {
		campaign: unknown | null;
		session: unknown | null;
		encounter: unknown | null;
	};
	campaigns: {
		items: unknown[];
		reloadVersion: number;
	};
	localization: {
		language: string;
		availableLanguages: string[];
	};
	ui: UiSettingsState;
	sync: {
		version: number;
		event: SyncEvent | null;
	};
	rulesReference: {
		isOpen: boolean;
		navigationRequest: RulesReferenceNavigationRequest | null;
		history: {
			entries: RulesReferenceHistoryEntry[];
			index: number;
		};
	};
}

export type AppThunk<TResult = unknown> = (
	dispatch: AppDispatch,
	getState: () => AppState,
) => TResult;

export interface AppDispatch {
	(action: AppAction): AppAction;
	<TResult>(thunk: AppThunk<TResult>): TResult;
}

export interface AppStore {
	getState(): AppState;
	dispatch: AppDispatch;
	subscribe(listener: () => void): () => void;
}
