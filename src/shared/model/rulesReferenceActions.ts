import type { RequestId } from "./contracts.ts";

export const REQUEST_RULES_REFERENCE_NAVIGATION =
	"rulesReference/requestNavigation";
export const SET_RULES_REFERENCE_MODAL_OPEN = "rulesReference/setModalOpen";
export const RECORD_RULES_REFERENCE_HISTORY_ENTRY =
	"rulesReference/recordHistoryEntry";
export const SET_RULES_REFERENCE_HISTORY_INDEX =
	"rulesReference/setHistoryIndex";

export interface RulesReferenceNavigationOptions {
	forceTab?: boolean;
}

export interface RulesReferenceNavigationRequest {
	requestId: RequestId;
	tabId: string;
	name: string;
	forceTab: boolean;
}

export interface RulesReferenceHistoryEntry {
	tabId: string;
	name: string;
}

export type RulesReferenceAction =
	| {
			type: typeof REQUEST_RULES_REFERENCE_NAVIGATION;
			payload: RulesReferenceNavigationRequest;
	  }
	| { type: typeof SET_RULES_REFERENCE_MODAL_OPEN; payload: boolean }
	| {
			type: typeof RECORD_RULES_REFERENCE_HISTORY_ENTRY;
			payload: RulesReferenceHistoryEntry;
	  }
	| { type: typeof SET_RULES_REFERENCE_HISTORY_INDEX; payload: number };

let rulesReferenceNavigationSeq: RequestId = 1;

export function requestRulesReferenceNavigationAction(
	tabId: unknown,
	name: unknown = "",
	options: RulesReferenceNavigationOptions = {},
): RulesReferenceAction {
	return {
		type: REQUEST_RULES_REFERENCE_NAVIGATION,
		payload: {
			requestId: rulesReferenceNavigationSeq++,
			tabId: String(tabId || "conditions"),
			name: String(name || ""),
			forceTab: Boolean(options.forceTab),
		},
	};
}

export function setRulesReferenceModalOpenAction(
	isOpen: unknown,
): RulesReferenceAction {
	return {
		type: SET_RULES_REFERENCE_MODAL_OPEN,
		payload: Boolean(isOpen),
	};
}

export function recordRulesReferenceHistoryEntryAction(
	tabId: unknown,
	name: unknown,
): RulesReferenceAction {
	return {
		type: RECORD_RULES_REFERENCE_HISTORY_ENTRY,
		payload: {
			tabId: String(tabId || ""),
			name: String(name || ""),
		},
	};
}

export function setRulesReferenceHistoryIndexAction(
	index: string | number,
): RulesReferenceAction {
	return {
		type: SET_RULES_REFERENCE_HISTORY_INDEX,
		payload: Number.parseInt(String(index), 10),
	};
}
