import type { BestiaryMonster } from "../../entities/bestiary/index.js";

export type MonsterAiEditMode = "edit" | "local-edit" | "create-based";

export type MonsterAiAction = MonsterAiEditMode | "image-prompt";

export interface MonsterAiEditPresentation {
	title: string;
	targetLabel: string;
	placeholder: string;
	submitLabel: string;
}

export interface EncounterMonsterTarget extends Record<string, unknown> {
	instanceId?: string;
	name?: string;
}

export type MonsterFieldSavePlan =
	| { kind: "invalid" }
	| {
			kind: "local";
			instanceId: string;
			monster: EncounterMonsterTarget;
		}
	| {
			kind: "persistent";
			mode: "edit" | "create";
			instanceId: string;
			originalName: string;
			monster: BestiaryMonster;
			normalizedName: string;
		};

export interface MonsterAiGenerationPlan {
	validationError?: string;
	finalInstructions: string;
	historyInstructions: string;
	customMonsterMode: "edit" | "create-based";
	historyMode?: "encounter";
	draftMode: "local" | "global";
}

export interface MonsterFieldPersistencePort {
	getCustomBestiaryData(): Promise<BestiaryMonster[] | null>;
	updateCustomBestiaryMonster(
		name: string,
		payload: { monster: BestiaryMonster },
	): Promise<BestiaryMonster | null>;
	replaceCustomBestiaryMonsters(
		monsters: BestiaryMonster[],
	): Promise<BestiaryMonster[] | null>;
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

export function getMonsterFieldSavePlan(
	mode: MonsterAiEditMode,
	original: EncounterMonsterTarget,
	draft: Record<string, unknown> | null | undefined,
): MonsterFieldSavePlan {
	if (!original.instanceId || !draft) return { kind: "invalid" };
	if (mode === "local-edit") {
		return {
			kind: "local",
			instanceId: original.instanceId,
			monster: preserveEncounterIdentity(draft, original),
		};
	}
	const monster = getNamedCustomMonster(draft);
	if (!monster) return { kind: "invalid" };
	return {
		kind: "persistent",
		mode: mode === "edit" ? "edit" : "create",
		instanceId: original.instanceId,
		originalName: String(original.name || ""),
		monster,
		normalizedName: normalizeMonsterName(monster.name),
	};
}

function preserveEncounterIdentity(
	draft: Record<string, unknown>,
	original: EncounterMonsterTarget,
): EncounterMonsterTarget {
	const monster: EncounterMonsterTarget = { ...draft, instanceId: original.instanceId };
	for (const key of ["id", "participantType"] as const) {
		if (!(key in monster) && original[key] !== undefined) monster[key] = original[key];
	}
	return monster;
}

function getNamedCustomMonster(
	draft: Record<string, unknown>,
): BestiaryMonster | null {
	if (typeof draft.name !== "string" || !draft.name.trim()) return null;
	return { ...draft, name: draft.name, source: "CUSTOM" };
}

export function normalizeMonsterName(value: unknown): string {
	return String(value || "").trim().toLowerCase();
}

export function hasCustomMonsterName(
	monsters: readonly BestiaryMonster[],
	normalizedName: string,
): boolean {
	return monsters.some((monster) => normalizeMonsterName(monster.name) === normalizedName);
}

export function findCustomMonsterByName(
	monsters: readonly BestiaryMonster[],
	normalizedName: string,
	fallback: BestiaryMonster,
): BestiaryMonster {
	return (
		monsters.find((monster) => normalizeMonsterName(monster.name) === normalizedName) ||
		fallback
	);
}

export function getMonsterAiGenerationPlan(
	mode: MonsterAiEditMode,
	instructions: string,
	monster: EncounterMonsterTarget,
	translate: (value: string) => string,
): MonsterAiGenerationPlan {
	const trimmedInstructions = instructions.trim();
	if (!trimmedInstructions && mode === "edit") {
		return {
			validationError: translate("Describe what to change."),
			finalInstructions: "",
			historyInstructions: "",
			customMonsterMode: "edit",
			draftMode: "global",
		};
	}
	if (mode === "local-edit") {
		return getLocalAiGenerationPlan(trimmedInstructions, monster, translate);
	}
	if (mode === "create-based") {
		return getCreateBasedAiGenerationPlan(trimmedInstructions, translate);
	}
	return {
		finalInstructions: trimmedInstructions,
		historyInstructions: trimmedInstructions,
		customMonsterMode: "edit",
		draftMode: "global",
	};
}

function getLocalAiGenerationPlan(
	instructions: string,
	monster: EncounterMonsterTarget,
	translate: (value: string) => string,
): MonsterAiGenerationPlan {
	return {
		finalInstructions: [
			translate(
				"Edit the selected creature for this encounter only. Return a complete custom creature stat block and do not change the global bestiary creature.",
			),
			`${translate("Current encounter creature")}:\n${JSON.stringify(monster, null, 2)}`,
			instructions,
		]
			.filter(Boolean)
			.join("\n\n"),
		historyInstructions: instructions,
		customMonsterMode: "create-based",
		historyMode: "encounter",
		draftMode: "local",
	};
}

function getCreateBasedAiGenerationPlan(
	instructions: string,
	translate: (value: string) => string,
): MonsterAiGenerationPlan {
	return {
		finalInstructions: [
			translate(
				"Create a new custom creature based on the selected creature. Do not change the selected creature.",
			),
			instructions,
		]
			.filter(Boolean)
			.join("\n\n"),
		historyInstructions: instructions,
		customMonsterMode: "create-based",
		draftMode: "global",
	};
}

export function getMonsterAiRestoreScope(
	draftMode: "local" | "global",
	campaignSlug: string,
): string {
	return draftMode === "local" ? campaignSlug : "bestiary";
}

export function getFirstGeneratedMonster(value: unknown): EncounterMonsterTarget | null {
	if (!value || typeof value !== "object") return null;
	const monsters = (value as { monsters?: unknown }).monsters;
	if (!Array.isArray(monsters)) return null;
	const monster = monsters[0];
	return monster && typeof monster === "object"
		? (monster as EncounterMonsterTarget)
		: null;
}

export async function persistMonsterFieldSavePlan(
	plan: Extract<MonsterFieldSavePlan, { kind: "persistent" }>,
	port: MonsterFieldPersistencePort,
	duplicateMessage: string,
): Promise<BestiaryMonster> {
	if (plan.mode === "edit") {
		const updated = await port.updateCustomBestiaryMonster(plan.originalName, {
			monster: plan.monster,
		});
		if (!updated) throw new Error("Monster update returned no result");
		return updated;
	}
	const monsters = (await port.getCustomBestiaryData()) || [];
	if (hasCustomMonsterName(monsters, plan.normalizedName)) {
		throw new Error(duplicateMessage);
	}
	const updated =
		(await port.replaceCustomBestiaryMonsters([...monsters, plan.monster])) || [];
	return findCustomMonsterByName(updated, plan.normalizedName, plan.monster);
}

export function buildMonsterAiRequestPayload({
	plan,
	modelName,
	campaignSlug,
	sessionId,
	encounterId,
	monster,
	targetInstanceId,
	language,
}: {
	plan: MonsterAiGenerationPlan;
	modelName: string;
	campaignSlug: string;
	sessionId: string;
	encounterId?: string | number;
	monster: EncounterMonsterTarget;
	targetInstanceId: string | null;
	language: string;
}): Record<string, unknown> {
	return {
		type: "custom-monster",
		modelName: modelName || undefined,
		userInstructions: plan.finalInstructions,
		historyUserInstructions: plan.historyInstructions,
		path: { campaign: campaignSlug, session: sessionId, encounter: encounterId },
		customMonsterTarget: monster,
		customMonsterMode: plan.customMonsterMode,
		parseAIResponse: true,
		generateCharacters: false,
		generateNpcs: false,
		generateLocations: false,
		generateEncounters: false,
		entityScope: "custom-bestiary",
		contextConfig: null,
		historyMode: plan.historyMode,
		targetInstanceId: targetInstanceId || monster.instanceId,
		language,
	};
}
