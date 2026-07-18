export type MonsterAiEditMode = "edit" | "local-edit" | "create-based";

export type MonsterAiAction = MonsterAiEditMode | "image-prompt";

export interface MonsterAiEditPresentation {
	title: string;
	targetLabel: string;
	placeholder: string;
	submitLabel: string;
}

type Translate = (value: string) => string;

export function getMonsterAiEditPresentation(
	mode: MonsterAiEditMode,
	translate: Translate,
): MonsterAiEditPresentation {
	if (mode === "local-edit") {
		return {
			title: translate("AI edit encounter creature"),
			targetLabel: translate("Encounter creature"),
			placeholder: translate(
				"Describe what to change for this encounter only.",
			),
			submitLabel: translate("Apply local AI edit"),
		};
	}

	if (mode === "create-based") {
		return {
			title: translate("Create custom creature based on this"),
			targetLabel: translate("Source creature"),
			placeholder: translate(
				"Describe what to create, or leave empty to let AI decide.",
			),
			submitLabel: translate("Create custom creature"),
		};
	}

	return {
		title: translate("AI edit custom creature"),
		targetLabel: translate("Custom creature"),
		placeholder: translate("Describe what to change."),
		submitLabel: translate("Apply AI edit"),
	};
}
