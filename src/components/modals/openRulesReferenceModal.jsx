export const OPEN_RULES_REFERENCE_MODAL_EVENT = "rules-reference-modal:open";

let rulesReferenceModalOpener = null;

export function setRulesReferenceModalOpener(opener) {
	rulesReferenceModalOpener = typeof opener === "function" ? opener : null;
}

export function openRulesReferenceModal(
	initialTab = "conditions",
	initialName = "",
) {
	if (rulesReferenceModalOpener) {
		rulesReferenceModalOpener({ initialTab, initialName });
		return;
	}

	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent(OPEN_RULES_REFERENCE_MODAL_EVENT, {
			detail: { initialTab, initialName },
		}),
	);
}
