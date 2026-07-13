import { requestRulesReferenceNavigation } from "../../../shared/model/index.js";

export function openRulesReferenceModal(
	initialTab = "conditions",
	initialName = "",
	options: Record<string, unknown> = {},
): void {
	requestRulesReferenceNavigation(initialTab, initialName, options);
}
