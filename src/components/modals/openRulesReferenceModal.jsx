import { requestRulesReferenceNavigation } from "../../features/reference-navigation/model.js";

export function openRulesReferenceModal(
	initialTab = "conditions",
	initialName = "",
	options = {},
) {
	requestRulesReferenceNavigation(initialTab, initialName, options);
}
