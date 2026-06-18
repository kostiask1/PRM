import { requestRulesReferenceNavigation } from "../../store/appStore.js";

export function openRulesReferenceModal(
	initialTab = "conditions",
	initialName = "",
) {
	requestRulesReferenceNavigation(initialTab, initialName);
}
