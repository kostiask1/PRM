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

export type MonsterFieldEditPlan =
	| { kind: "none" }
	| {
			kind: "edit";
			mode: MonsterAiEditMode;
			original: EncounterMonsterTarget;
			monster: EncounterMonsterTarget;
	  };

export interface MonsterFieldSaveEffects {
	onLocal(instanceId: string, monster: EncounterMonsterTarget): void;
	onPersistent(instanceId: string, monster: BestiaryMonster): void;
	onRefresh(): void;
	onClose(): void;
	onError(error: unknown): void;
}

export interface MonsterAiDraftSavePlan<TResource> {
	scope: string;
	entryId: string | number;
	resources: TResource[];
	acceptEmptyResult: boolean;
}

export interface MonsterAiRestoreRequestPlan {
	scope: string;
	entryId: string | number;
	action: "apply" | "undo";
	resourceIds?: string[];
}

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

export interface MonsterAiRequestLifecycle<TResult> {
	request(signal: AbortSignal): Promise<TResult>;
	onResult(result: TResult): void;
	onError(message: string): void;
	onComplete(): void;
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
	const context = getMonsterFieldSaveContext(original, draft);
	if (!context) return { kind: "invalid" };
	return mode === "local-edit"
		? getLocalMonsterFieldSavePlan(context)
		: getPersistentMonsterFieldSavePlan(mode, context);
}

interface MonsterFieldSaveContext {
	original: EncounterMonsterTarget & { instanceId: string };
	draft: Record<string, unknown>;
}

function getMonsterFieldSaveContext(
	original: EncounterMonsterTarget,
	draft: Record<string, unknown> | null | undefined,
): MonsterFieldSaveContext | null {
	if (!original.instanceId) return null;
	if (!draft) return null;
	return {
		original: original as EncounterMonsterTarget & { instanceId: string },
		draft,
	};
}

function getLocalMonsterFieldSavePlan(
	context: MonsterFieldSaveContext,
): Extract<MonsterFieldSavePlan, { kind: "local" }> {
	return {
		kind: "local",
		instanceId: context.original.instanceId,
		monster: preserveEncounterIdentity(context.draft, context.original),
	};
}

function getPersistentMonsterFieldSavePlan(
	mode: MonsterAiEditMode,
	context: MonsterFieldSaveContext,
): MonsterFieldSavePlan {
	const { original, draft } = context;
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

export function getMonsterFieldEditPlan(
	action: MonsterAiAction,
	target: EncounterMonsterTarget | null,
	defaultName: string,
): MonsterFieldEditPlan {
	if (action === "image-prompt" || !target) return { kind: "none" };
	return {
		kind: "edit",
		mode: action,
		original: target,
		monster: getMonsterFieldEditDraft(action, target, defaultName),
	};
}

function getMonsterFieldEditDraft(
	mode: MonsterAiEditMode,
	target: EncounterMonsterTarget,
	defaultName: string,
): EncounterMonsterTarget {
	if (mode !== "create-based") return target;
	return {
		...target,
		name: target.name || defaultName,
		source: "CUSTOM",
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

export function getMonsterAiDraftSavePlan<TResource>(
	entryId: string | number | null | undefined,
	draftMode: "local" | "global",
	campaignSlug: string,
	resources: TResource[],
): MonsterAiDraftSavePlan<TResource> | null {
	if (!entryId) return null;
	return {
		scope: getMonsterAiRestoreScope(draftMode, campaignSlug),
		entryId,
		resources,
		acceptEmptyResult: draftMode === "local",
	};
}

export function applyMonsterAiDraftSaveResult<TResult>(
	plan: MonsterAiDraftSavePlan<unknown>,
	result: TResult | null,
	onEntry: (entry: TResult | null) => void,
): TResult | null {
	if (result || plan.acceptEmptyResult) onEntry(result);
	return result;
}

export function getMonsterAiRestoreRequestPlan(
	entryId: string | number | null | undefined,
	isRestoring: boolean,
	draftMode: "local" | "global",
	campaignSlug: string,
	action: "apply" | "undo",
	resourceIds?: string[],
): MonsterAiRestoreRequestPlan | null {
	if (!entryId || isRestoring) return null;
	return {
		scope: getMonsterAiRestoreScope(draftMode, campaignSlug),
		entryId,
		action,
		resourceIds,
	};
}

export function getFirstGeneratedMonster(value: unknown): EncounterMonsterTarget | null {
	const monster = getGeneratedMonsterList(value)[0];
	return monster && typeof monster === "object"
		? (monster as EncounterMonsterTarget)
		: null;
}

function getGeneratedMonsterList(value: unknown): unknown[] {
	if (!value || typeof value !== "object") return [];
	const monsters = (value as { monsters?: unknown }).monsters;
	return Array.isArray(monsters) ? monsters : [];
}

export async function persistMonsterFieldSavePlan(
	plan: Extract<MonsterFieldSavePlan, { kind: "persistent" }>,
	port: MonsterFieldPersistencePort,
	duplicateMessage: string,
): Promise<BestiaryMonster> {
	return plan.mode === "edit"
		? persistEditedMonster(plan, port)
		: persistCreatedMonster(plan, port, duplicateMessage);
}

async function persistEditedMonster(
	plan: Extract<MonsterFieldSavePlan, { kind: "persistent" }>,
	port: MonsterFieldPersistencePort,
): Promise<BestiaryMonster> {
	const updated = await port.updateCustomBestiaryMonster(plan.originalName, {
		monster: plan.monster,
	});
	if (!updated) throw new Error("Monster update returned no result");
	return updated;
}

async function persistCreatedMonster(
	plan: Extract<MonsterFieldSavePlan, { kind: "persistent" }>,
	port: MonsterFieldPersistencePort,
	duplicateMessage: string,
): Promise<BestiaryMonster> {
	const monsters = normalizeCustomMonsterList(await port.getCustomBestiaryData());
	if (hasCustomMonsterName(monsters, plan.normalizedName)) {
		throw new Error(duplicateMessage);
	}
	const updated = normalizeCustomMonsterList(
		await port.replaceCustomBestiaryMonsters([...monsters, plan.monster]),
	);
	return findCustomMonsterByName(updated, plan.normalizedName, plan.monster);
}

function normalizeCustomMonsterList(
	monsters: BestiaryMonster[] | null,
): BestiaryMonster[] {
	return monsters || [];
}

export async function executeMonsterFieldSavePlan(
	plan: MonsterFieldSavePlan,
	port: MonsterFieldPersistencePort,
	duplicateMessage: string,
	effects: MonsterFieldSaveEffects,
): Promise<void> {
	if (plan.kind === "invalid") return;
	if (plan.kind === "local") {
		effects.onLocal(plan.instanceId, plan.monster);
		effects.onClose();
		return;
	}
	await executePersistentMonsterFieldSave(plan, port, duplicateMessage, effects);
}

async function executePersistentMonsterFieldSave(
	plan: Extract<MonsterFieldSavePlan, { kind: "persistent" }>,
	port: MonsterFieldPersistencePort,
	duplicateMessage: string,
	effects: MonsterFieldSaveEffects,
): Promise<void> {
	try {
		const monster = await persistMonsterFieldSavePlan(plan, port, duplicateMessage);
		effects.onRefresh();
		effects.onPersistent(plan.instanceId, monster);
		effects.onClose();
	} catch (error) {
		effects.onError(error);
	}
}

export async function executeMonsterAiRequest<TResult>(
	controller: AbortController,
	lifecycle: MonsterAiRequestLifecycle<TResult>,
): Promise<void> {
	try {
		lifecycle.onResult(await lifecycle.request(controller.signal));
	} catch (error) {
		applyMonsterAiRequestError(error, lifecycle.onError);
	} finally {
		lifecycle.onComplete();
	}
}

function applyMonsterAiRequestError(
	error: unknown,
	onError: (message: string) => void,
): void {
	if (error instanceof Error) {
		if (error.name !== "AbortError") onError(error.message);
		return;
	}
	onError("Unknown error");
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
