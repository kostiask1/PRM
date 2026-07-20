import type { CharacterData } from "../../../entities/campaign/index.js";
import { MonsterStatBlockModel } from "../../../entities/bestiary/index.js";
import { ensureEncounterMonsterId } from "../../../entities/encounter/index.js";
import type { EncounterEditorState } from "../../../features/encounter-editor/index.js";
import type {
	EncounterSyncEvent,
	EncounterViewParticipant,
	EncounterViewState,
	MonsterAiUpdateOptions,
} from "./contracts.ts";

export type EncounterNavigationAction = "close-bestiary" | "back" | "none";
export type EncounterHistoryAction = "undo" | "redo" | "none";

export interface EncounterKeyboardInput {
	key: string;
	code: string;
	shiftKey: boolean;
	isEditableTarget: boolean;
	isHistoryShortcut: boolean;
	shouldUseAppHistory: boolean;
	showBestiary: boolean;
}

export interface EncounterMonsterRowStats {
	ac: string | number;
	maxHp: string | number;
}

export interface EncounterDiceResultInput {
	result?: { total?: unknown } | null;
	context?: {
		kind?: string;
		campaignSlug?: string;
		sessionId?: string;
		encounterId?: string;
		instanceId?: string;
	} | null;
	campaignSlug: string;
	sessionId: string;
	encounterId: string;
	encounter: EncounterViewState | null;
}

export interface EncounterDiceHpUpdate {
	encounter: EncounterViewState;
	preferredId: string;
}

export function isCustomBestiarySource(source: unknown): boolean {
	return String(source || "").toUpperCase() === "CUSTOM";
}

export function getEncounterGridMonsterKey(
	monster: EncounterViewParticipant,
): string {
	if (monster._localOverride) return getLocalMonsterKey(monster);
	const baseName = normalizeKeyPart(monster.originalBestiaryName || monster.name);
	if (!baseName) return String(monster.instanceId || "");
	return `${baseName}|${normalizeKeyPart(monster.source)}`;
}

function getLocalMonsterKey(monster: EncounterViewParticipant): string {
	return `local:${monster.instanceId || monster.id || monster.name || ""}`;
}

function normalizeKeyPart(value: unknown): string {
	return String(value || "").trim().toLowerCase();
}

export function createEmptyEncounterCharacterDraft(now = Date.now()): CharacterData {
	return {
		id: `new-character-${now}`,
		firstName: "",
		lastName: "",
		race: "",
		class: "",
		level: 1,
		motivation: "",
		description: "",
		trait: "",
		notes: [{ id: now + 1, title: "", text: "", collapsed: false }],
		collapsed: false,
		isNotesCollapsed: false,
	};
}

export function resolveEncounterHpInputValue(
	inputValue: unknown,
	previousHp: unknown,
): number {
	const text = String(inputValue ?? "").trim();
	const previousValue = parseInteger(previousHp);
	const relativeMatch = text.match(/^([+-])\s*(\d+)$/);
	if (!relativeMatch) return Math.max(0, parseInteger(text));
	return applyRelativeHp(previousValue, relativeMatch[1], relativeMatch[2]);
}

function applyRelativeHp(previous: number, operator: string, value: string): number {
	const delta = parseInteger(value);
	return Math.max(0, operator === "-" ? previous - delta : previous + delta);
}

function parseInteger(value: unknown): number {
	return Number.parseInt(String(value ?? ""), 10) || 0;
}

export function getEncounterMonsterRowStats(
	monster: EncounterViewParticipant,
): EncounterMonsterRowStats {
	const modelInput: Record<string, unknown> = { ...monster };
	const model = new MonsterStatBlockModel(modelInput);
	return {
		ac: String(model.ac.val ?? monster.armor_class ?? "-"),
		maxHp: Number(monster.hit_points ?? model.hp.val ?? 0) || 0,
	};
}

export function getEncounterNavigationAction(
	input: EncounterKeyboardInput,
): EncounterNavigationAction {
	if (input.key === "Escape" && input.showBestiary) return "close-bestiary";
	if (input.isEditableTarget) return "none";
	return input.key === "Backspace" || input.key === "Escape" ? "back" : "none";
}

export function getEncounterHistoryAction(
	input: EncounterKeyboardInput,
): EncounterHistoryAction {
	if (input.isEditableTarget && !input.shouldUseAppHistory) return "none";
	if (!input.isHistoryShortcut) return "none";
	if (input.code === "KeyZ") return input.shiftKey ? "redo" : "undo";
	return input.code === "KeyY" ? "redo" : "none";
}

export function shouldReloadEncounterFromSync(
	event: EncounterSyncEvent | null | undefined,
	campaignSlug: string,
	sessionId: string,
	hasPendingSave: boolean,
): boolean {
	if (!event?.version || hasPendingSave) return false;
	if (!matchesEncounterSyncScope(event, campaignSlug, sessionId)) return false;
	return ["sessions", "ai", "import"].includes(String(event.resource || ""));
}

function matchesEncounterSyncScope(
	event: EncounterSyncEvent,
	campaignSlug: string,
	sessionId: string,
): boolean {
	if (event.campaignSlug && event.campaignSlug !== campaignSlug) return false;
	if (!event.sessionFileName) return true;
	return String(event.sessionFileName) === String(sessionId);
}

export function getSelectedEncounterParticipant(
	encounter: EncounterViewState | null,
	preferredId?: string | null,
	previousId?: string | null,
): EncounterViewParticipant | null {
	if (!encounter?.monsters.length) return null;
	const targetId = preferredId || previousId;
	if (!targetId) return encounter.monsters[0];
	return (
		encounter.monsters.find((monster) => monster.instanceId === targetId) ||
		encounter.monsters[0]
	);
}

export function normalizeEncounterViewState(
	next: EncounterEditorState,
	current: EncounterViewState | null,
): EncounterViewState {
	return {
		...next,
		name: String(next.name || current?.name || ""),
		monsters: Array.isArray(next.monsters) ? next.monsters : [],
	};
}

export function replaceEncounterMonsterFromAi(
	encounter: EncounterViewState,
	instanceId: string,
	nextMonster: EncounterViewParticipant,
	options: MonsterAiUpdateOptions = {},
): EncounterViewState {
	return {
		...encounter,
		monsters: encounter.monsters.map((monster) =>
			monster.instanceId === instanceId
				? mergeEncounterMonsterFromAi(monster, nextMonster, instanceId, options)
				: monster,
		),
	};
}

function mergeEncounterMonsterFromAi(
	current: EncounterViewParticipant,
	next: EncounterViewParticipant,
	instanceId: string,
	options: MonsterAiUpdateOptions,
): EncounterViewParticipant {
	const maxHp = getNextMonsterMaxHp(next, current);
	const currentHp = getNextMonsterCurrentHp(next, current, maxHp, options);
	return {
		...ensureEncounterMonsterId(next),
		instanceId,
		...getLocalMonsterIdentity(current, next, options.localOverride),
		currentHp,
		hit_points: maxHp,
	};
}

function getNextMonsterMaxHp(
	next: EncounterViewParticipant,
	current: EncounterViewParticipant,
): number {
	const structuredHp = next.hp && typeof next.hp === "object"
		? (next.hp as { average?: unknown }).average
		: undefined;
	return parseInteger(next.hit_points ?? structuredHp) || parseInteger(current.hit_points);
}

function getNextMonsterCurrentHp(
	next: EncounterViewParticipant,
	current: EncounterViewParticipant,
	maxHp: number,
	options: MonsterAiUpdateOptions,
): number {
	const candidate = options.preserveCurrentHp === false && next.currentHp !== undefined
		? Number.parseInt(String(next.currentHp), 10)
		: Number(current.currentHp);
	return Math.min(Number.isFinite(candidate) ? candidate : maxHp, maxHp);
}

function getLocalMonsterIdentity(
	current: EncounterViewParticipant,
	next: EncounterViewParticipant,
	localOverride: boolean | undefined,
): Partial<EncounterViewParticipant> {
	if (!localOverride) return {};
	return {
		source: current.source,
		originalBestiaryName:
			current.originalBestiaryName || next.originalBestiaryName || next.name,
		_localOverride: true,
	};
}

export function applyEncounterDiceHpResult({
	result,
	context,
	campaignSlug,
	sessionId,
	encounterId,
	encounter,
}: EncounterDiceResultInput): EncounterDiceHpUpdate | null {
	if (!result || !context || !encounter || !context.instanceId) return null;
	if (!matchesEncounterDiceContext(context, campaignSlug, sessionId, encounterId)) {
		return null;
	}
	const rolledHp = Math.max(1, Number(result.total) || 0);
	const monsters = replaceMonsterHp(encounter.monsters, context.instanceId, rolledHp);
	if (monsters === encounter.monsters) return null;
	return { encounter: { ...encounter, monsters }, preferredId: context.instanceId };
}

function matchesEncounterDiceContext(
	context: NonNullable<EncounterDiceResultInput["context"]>,
	campaignSlug: string,
	sessionId: string,
	encounterId: string,
): boolean {
	return (
		context.kind === "encounter_hp" &&
		context.campaignSlug === campaignSlug &&
		String(context.sessionId) === String(sessionId) &&
		String(context.encounterId) === String(encounterId)
	);
}

function replaceMonsterHp(
	monsters: EncounterViewParticipant[],
	instanceId: string,
	hp: number,
): EncounterViewParticipant[] {
	const index = monsters.findIndex((monster) => monster.instanceId === instanceId);
	if (index < 0) return monsters;
	return monsters.map((monster, monsterIndex) =>
		monsterIndex === index
			? { ...monster, hit_points: hp, currentHp: hp }
			: monster,
	);
}
