import { requestRulesReferenceNavigation } from "../../store/appStore.js";

export function openRulesReferenceModal(
	initialTab = "conditions",
	initialName = "",
	options = {},
) {
	requestRulesReferenceNavigation(initialTab, initialName, options);
}
