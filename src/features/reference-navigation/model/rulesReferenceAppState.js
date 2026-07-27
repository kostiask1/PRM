import { getAppStore } from "../../../shared/lib/index.js";

export const REQUEST_RULES_REFERENCE_NAVIGATION =
	"rulesReference/requestNavigation";
export const SET_RULES_REFERENCE_MODAL_OPEN = "rulesReference/setModalOpen";
export const RECORD_RULES_REFERENCE_HISTORY_ENTRY =
	"rulesReference/recordHistoryEntry";
export const SET_RULES_REFERENCE_HISTORY_INDEX =
	"rulesReference/setHistoryIndex";

let rulesReferenceNavigationSeq = 1;

export function requestRulesReferenceNavigationAction(
	tabId,
	name = "",
	options = {},
) {
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

export function setRulesReferenceModalOpenAction(isOpen) {
	return {
		type: SET_RULES_REFERENCE_MODAL_OPEN,
		payload: Boolean(isOpen),
	};
}

export function recordRulesReferenceHistoryEntryAction(tabId, name) {
	return {
		type: RECORD_RULES_REFERENCE_HISTORY_ENTRY,
		payload: {
			tabId: String(tabId || ""),
			name: String(name || ""),
		},
	};
}

export function setRulesReferenceHistoryIndexAction(index) {
	return {
		type: SET_RULES_REFERENCE_HISTORY_INDEX,
		payload: Number.parseInt(index, 10),
	};
}

export function requestRulesReferenceNavigation(tabId, name = "", options = {}) {
	getAppStore().dispatch(
		requestRulesReferenceNavigationAction(tabId, name, options),
	);
}

export function setRulesReferenceModalOpen(isOpen) {
	getAppStore().dispatch(setRulesReferenceModalOpenAction(isOpen));
}

export function recordRulesReferenceHistoryEntry(tabId, name) {
	getAppStore().dispatch(recordRulesReferenceHistoryEntryAction(tabId, name));
}

export function setRulesReferenceHistoryIndex(index) {
	getAppStore().dispatch(setRulesReferenceHistoryIndexAction(index));
}
