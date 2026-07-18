import type {
	BestiaryFavorite,
	BestiaryMonster,
	LegendaryGroup,
} from "../../../entities/bestiary/api/bestiaryApi.ts";
import type {
	AiHistoryEntry,
	AiHistoryResource,
} from "../../../features/ai/index.js";

export interface MonsterReference {
	name: string;
	source: string;
}

export type BestiarySortOrder = "none" | "desc" | "asc";

export interface BestiaryFilterOptions {
	selectedSources: string[];
	sourceFilter: string;
	onlyFavorites: boolean;
	favorites: BestiaryFavorite[];
	search: string;
	isDetailedSearch: boolean;
	matchesDetailedSearch: (monster: BestiaryMonster, search: string) => boolean;
	matchesSimpleSearch: (monster: BestiaryMonster, search: string) => boolean;
}

export interface CustomBestiaryUpdateOptions {
	generated?: { monsters?: BestiaryMonster[] } | null;
	selectedName?: string;
	trackUndo?: boolean;
}

export interface CustomBestiaryUpdatePlan {
	hasUpdatedMonsters: boolean;
	updatedMonsters: BestiaryMonster[];
	nextSelectedMonster: BestiaryMonster | null;
	trackUndo: boolean;
}

export interface BestiarySelectionPlan {
	monster: BestiaryMonster;
	explicit: boolean;
}

export interface BestiarySyncEvent {
	version: string | number;
	resource: string;
	monsterName?: string;
	monsterSource?: string;
}

export interface AiBestiaryGenerationResult {
	draft: boolean;
	aiResponse: AiHistoryEntry | null;
	updated: unknown;
	generated: CustomBestiaryUpdateOptions["generated"];
}

export interface CreateBasedMonsterPlan {
	duplicate: boolean;
	normalizedName: string;
	monster: BestiaryMonster;
}

export interface AiMonsterInstructionPlan {
	error: "missing-instructions" | null;
	instructions: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeMonsterName(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

export function normalizeMonsterSource(value: unknown): string {
	return String(value ?? "").trim().toUpperCase();
}

export function isCustomSource(source: unknown): boolean {
	return normalizeMonsterSource(source) === "CUSTOM";
}

export function parseMonsterReference(
	value: unknown,
	fallbackSource = "",
): MonsterReference {
	const [rawName = "", rawSource = ""] = String(value ?? "").split("|");
	return {
		name: rawName.trim(),
		source: String(fallbackSource || rawSource).trim(),
	};
}

export function isSameMonsterIdentity(
	left: BestiaryMonster | null | undefined,
	right: BestiaryMonster | null | undefined,
): boolean {
	const leftName = normalizeMonsterName(left?.name);
	const rightName = normalizeMonsterName(right?.name);
	if (!leftName) return false;
	if (leftName !== rightName) return false;
	return normalizeMonsterSource(left?.source) === normalizeMonsterSource(right?.source);
}

export function monsterMatchesReference(
	monster: BestiaryMonster | null | undefined,
	reference: MonsterReference | null | undefined,
): boolean {
	if (!reference) return false;
	if (normalizeMonsterName(monster?.name) !== normalizeMonsterName(reference.name)) {
		return false;
	}
	const source = normalizeMonsterSource(reference.source);
	return !source || normalizeMonsterSource(monster?.source) === source;
}

export function findCustomMonsterByName(
	monsters: BestiaryMonster[],
	name: unknown,
): BestiaryMonster | null {
	const normalizedName = normalizeMonsterName(name);
	if (!normalizedName) return null;
	return (
		monsters.find(
			(monster) =>
				isCustomSource(monster.source) &&
				normalizeMonsterName(monster.name) === normalizedName,
		) ?? null
	);
}

export function getMonsterListIndex(
	monsters: BestiaryMonster[],
	selectedMonster: BestiaryMonster | null | undefined,
): number {
	if (!selectedMonster?.name) return -1;
	return monsters.findIndex((monster) =>
		isSameMonsterIdentity(monster, selectedMonster),
	);
}

export function getAutoSelectedMonster(
	monsters: BestiaryMonster[],
): BestiaryMonster | null {
	return monsters.find((monster) => !isCustomSource(monster.source)) ?? null;
}

export function cloneCustomMonsters(
	monsters: BestiaryMonster[] | null | undefined,
): BestiaryMonster[] {
	return JSON.parse(JSON.stringify(monsters ?? [])) as BestiaryMonster[];
}

export function customMonsterListsEqual(
	left: BestiaryMonster[] | null | undefined,
	right: BestiaryMonster[] | null | undefined,
): boolean {
	return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function isBestiaryMonster(value: unknown): value is BestiaryMonster {
	return isRecord(value) && typeof value.name === "string";
}

export function getMonsterListFromResponse(data: unknown): BestiaryMonster[] {
	if (Array.isArray(data)) return data.filter(isBestiaryMonster);
	if (!isRecord(data)) return [];
	const candidates = [data.monster, data.monsters, data.results];
	const list = candidates.find(Array.isArray);
	return Array.isArray(list) ? list.filter(isBestiaryMonster) : [];
}

export function getBestiarySourceCodes(data: unknown): string[] {
	if (!Array.isArray(data)) return [];
	return data
		.map((source) => {
			if (typeof source === "string") return source;
			if (!isRecord(source)) return "";
			const value = source.value ?? source.source ?? source.id ?? source.name;
			return typeof value === "string" ? value : "";
		})
		.filter(Boolean);
}

export function parseBestiarySyncEvent(value: unknown): BestiarySyncEvent | null {
	if (!isRecord(value)) return null;
	if (typeof value.resource !== "string") return null;
	if (typeof value.version !== "string" && typeof value.version !== "number") {
		return null;
	}
	return {
		version: value.version,
		resource: value.resource,
		monsterName:
			typeof value.monsterName === "string" ? value.monsterName : undefined,
		monsterSource:
			typeof value.monsterSource === "string" ? value.monsterSource : undefined,
	};
}

export function normalizeAiBestiaryGenerationResult(
	value: unknown,
): AiBestiaryGenerationResult {
	const record = isRecord(value) ? value : {};
	return {
		draft: record.draft === true,
		aiResponse: isRecord(record.aiResponse)
			? (record.aiResponse as AiHistoryEntry)
			: null,
		updated: record.updated,
		generated: isRecord(record.generated)
			? {
					monsters: getMonsterListFromResponse({
						monsters: record.generated.monsters,
					}),
				}
			: undefined,
	};
}

function getResourceAfterRecord(
	resource: AiHistoryResource | undefined,
): Record<string, unknown> | null {
	return isRecord(resource?.after) ? resource.after : null;
}

export function preserveAiDraftResourceMetadata(
	resources: AiHistoryResource[],
	sourceResources: AiHistoryResource[] | null | undefined,
): AiHistoryResource[] {
	const sourceById = new Map(
		(sourceResources ?? []).map((resource) => [String(resource.id), resource]),
	);
	return resources.map((resource) => {
		const after = getResourceAfterRecord(resource);
		if (!after) return resource;
		const sourceAfter = getResourceAfterRecord(sourceById.get(String(resource.id)));
		if (!sourceAfter) return resource;
		return {
			...resource,
			after: {
				...after,
				imageUrl: after.imageUrl || sourceAfter.imageUrl,
				originalBestiaryName:
					after.originalBestiaryName || sourceAfter.originalBestiaryName,
			},
		};
	});
}

function getMonsterImageUrl(monster: BestiaryMonster | null | undefined): string {
	return typeof monster?.imageUrl === "string" ? monster.imageUrl : "";
}

export function getCreateBasedMonsterPlan(
	currentMonsters: BestiaryMonster[],
	draftMonster: BestiaryMonster,
	originalMonster: BestiaryMonster | null,
	fallbackImageUrl: string,
): CreateBasedMonsterPlan {
	const normalizedName = normalizeMonsterName(draftMonster.name);
	return {
		duplicate: currentMonsters.some(
			(monster) => normalizeMonsterName(monster.name) === normalizedName,
		),
		normalizedName,
		monster: {
			...draftMonster,
			source: "CUSTOM",
			imageUrl:
				getMonsterImageUrl(draftMonster) ||
				getMonsterImageUrl(originalMonster) ||
				fallbackImageUrl,
		},
	};
}

export function getEditedCustomMonsterPayload(
	draftMonster: BestiaryMonster,
	editingMonster: BestiaryMonster,
	originalMonster: BestiaryMonster | null,
): BestiaryMonster {
	return {
		...draftMonster,
		source: "CUSTOM",
		imageUrl:
			draftMonster.imageUrl ??
			editingMonster.imageUrl ??
			originalMonster?.imageUrl ??
			null,
	};
}

export function getAiMonsterInstructionPlan(
	mode: "edit" | "local-edit" | "create-based",
	rawInstructions: string,
	createInstruction: string,
): AiMonsterInstructionPlan {
	const instructions = rawInstructions.trim();
	if (mode !== "create-based") {
		return {
			error: instructions ? null : "missing-instructions",
			instructions,
		};
	}
	return {
		error: null,
		instructions: [createInstruction, instructions].filter(Boolean).join("\n\n"),
	};
}

export function isAbortError(error: unknown): boolean {
	return (
		error instanceof DOMException &&
		error.name === "AbortError"
	);
}

function getLegendaryGroupIdentity(group: LegendaryGroup): MonsterReference {
	return {
		name: typeof group.name === "string" ? group.name : "",
		source: typeof group.source === "string" ? group.source : "",
	};
}

function getMonsterLegendaryReference(monster: BestiaryMonster): MonsterReference {
	const reference = isRecord(monster.legendaryGroup)
		? monster.legendaryGroup
		: null;
	return {
		name: typeof reference?.name === "string" ? reference.name : monster.name,
		source:
			typeof reference?.source === "string"
				? reference.source
				: String(monster.source ?? ""),
	};
}

export function enrichMonstersWithLegendaryGroups(
	monsters: BestiaryMonster[],
	legendaryGroups: LegendaryGroup[],
): BestiaryMonster[] {
	const groupsByIdentity = new Map(
		legendaryGroups.map((group) => {
			const identity = getLegendaryGroupIdentity(group);
			return [`${normalizeMonsterName(identity.name)}|${normalizeMonsterSource(identity.source)}`, group];
		}),
	);
	return monsters.map((monster) => {
		const identity = getMonsterLegendaryReference(monster);
		const group = groupsByIdentity.get(
			`${normalizeMonsterName(identity.name)}|${normalizeMonsterSource(identity.source)}`,
		);
		if (!group) return monster;
		return {
			...monster,
			lairActions: group.lairActions,
			regionalEffects: group.regionalEffects,
		};
	});
}

export function isFavoriteMonster(
	favorites: BestiaryFavorite[],
	monster: BestiaryMonster | null | undefined,
): boolean {
	return favorites.some((favorite) => isSameMonsterIdentity(favorite, monster));
}

export function getMonsterItemKey(monster: BestiaryMonster): string {
	return `${String(monster.source ?? "")}:${monster.name}`;
}

export function getMonsterSizeText(monster: BestiaryMonster): string {
	return String(Array.isArray(monster.size) ? monster.size[0] ?? "" : monster.size ?? "");
}

export function getMonsterTagText(monster: BestiaryMonster): string {
	if (!monster.type || typeof monster.type === "string") return "";
	return (monster.type.tags ?? [])
		.map((tag) => (isRecord(tag) ? tag.tag : tag))
		.filter((tag): tag is string => typeof tag === "string")
		.join(", ");
}

export function getMonsterCrDisplay(monster: BestiaryMonster): string | number {
	const cr = isRecord(monster.cr) ? monster.cr.cr : monster.cr;
	return typeof cr === "string" || typeof cr === "number" ? cr : "";
}

export function parseMonsterCr(monster: BestiaryMonster): number {
	const structuredCr = isRecord(monster.cr) ? monster.cr.cr : monster.cr;
	if (typeof structuredCr === "number") return structuredCr;
	const text = String(structuredCr ?? "0");
	if (!text.includes("/")) return Number.parseFloat(text) || 0;
	const [numerator = "0", denominator = "0"] = text.split("/");
	const denominatorValue = Number(denominator);
	return denominatorValue ? Number(numerator) / denominatorValue : 0;
}

export function sortBestiaryMonsters(
	monsters: BestiaryMonster[],
	order: BestiarySortOrder,
): BestiaryMonster[] {
	if (order === "none") return [...monsters];
	const direction = order === "desc" ? -1 : 1;
	return [...monsters].sort((left, right) => {
		const crDifference = parseMonsterCr(left) - parseMonsterCr(right);
		return crDifference
			? crDifference * direction
			: left.name.localeCompare(right.name);
	});
}

function matchesSelectedSource(
	monster: BestiaryMonster,
	selectedSources: string[],
): boolean {
	const monsterSource = normalizeMonsterSource(monster.source);
	return selectedSources.some(
		(source) => normalizeMonsterSource(source) === monsterSource,
	);
}

export function filterBestiaryMonsters(
	monsters: BestiaryMonster[],
	options: BestiaryFilterOptions,
): BestiaryMonster[] {
	return monsters.filter((monster) => {
		if (!matchesSelectedSource(monster, options.selectedSources)) return false;
		if (
			options.sourceFilter !== "all" &&
			normalizeMonsterSource(monster.source) !==
				normalizeMonsterSource(options.sourceFilter)
		) {
			return false;
		}
		if (options.onlyFavorites && !isFavoriteMonster(options.favorites, monster)) {
			return false;
		}
		const matcher = options.isDetailedSearch
			? options.matchesDetailedSearch
			: options.matchesSimpleSearch;
		return matcher(monster, options.search);
	});
}

function getGeneratedMonsterSelection(
	updatedMonsters: BestiaryMonster[],
	generatedMonsters: BestiaryMonster[],
): BestiaryMonster | null {
	const generated = generatedMonsters[0];
	if (!generated) return null;
	return findCustomMonsterByName(updatedMonsters, generated.name) ?? generated;
}

function getRequestedMonsterSelection(
	updatedMonsters: BestiaryMonster[],
	selectedName: string | undefined,
): BestiaryMonster | null {
	return selectedName
		? findCustomMonsterByName(updatedMonsters, selectedName)
		: null;
}

export function getCustomBestiaryUpdatePlan(
	updated: unknown,
	options: CustomBestiaryUpdateOptions = {},
): CustomBestiaryUpdatePlan {
	const record = isRecord(updated) ? updated : null;
	const hasUpdatedMonsters = Array.isArray(record?.monsters);
	const updatedMonsters = hasUpdatedMonsters
		? getMonsterListFromResponse({ monsters: record?.monsters })
		: [];
	const generatedMonsters = getMonsterListFromResponse(options.generated);
	const selectedGenerated = getGeneratedMonsterSelection(
		updatedMonsters,
		generatedMonsters,
	);
	const selectedUpdated = getRequestedMonsterSelection(
		updatedMonsters,
		options.selectedName,
	);
	return {
		hasUpdatedMonsters,
		updatedMonsters,
		nextSelectedMonster: selectedGenerated ?? selectedUpdated,
		trackUndo: hasUpdatedMonsters && options.trackUndo !== false,
	};
}

function findReferencedMonster(
	displayedMonsters: BestiaryMonster[],
	allMonsters: BestiaryMonster[],
	reference: MonsterReference,
): BestiaryMonster | null {
	return (
		displayedMonsters.find((monster) =>
			monsterMatchesReference(monster, reference),
		) ??
		allMonsters.find((monster) => monsterMatchesReference(monster, reference)) ??
		null
	);
}

function getAutomaticMonsterSelection(
	displayedMonsters: BestiaryMonster[],
	currentMonster: BestiaryMonster | null,
	shouldAutoSelect: boolean,
): BestiarySelectionPlan | null {
	if (!shouldAutoSelect) return null;
	const monster = getAutoSelectedMonster(displayedMonsters);
	if (!monster) return null;
	if (currentMonster && getMonsterListIndex(displayedMonsters, currentMonster) >= 0) {
		return null;
	}
	return { monster, explicit: false };
}

export function getBestiarySelectionPlan(
	displayedMonsters: BestiaryMonster[],
	allMonsters: BestiaryMonster[],
	reference: MonsterReference,
	currentMonster: BestiaryMonster | null,
	shouldAutoSelect: boolean,
): BestiarySelectionPlan | null {
	if (reference.name) {
		const monster = findReferencedMonster(
			displayedMonsters,
			allMonsters,
			reference,
		);
		return monster ? { monster, explicit: true } : null;
	}
	return getAutomaticMonsterSelection(
		displayedMonsters,
		currentMonster,
		shouldAutoSelect,
	);
}

export function getCustomRefreshSelection(
	customMonsters: BestiaryMonster[],
	pendingSelection: MonsterReference | null | undefined,
	currentSelection: BestiaryMonster | null | undefined,
): BestiaryMonster | null {
	const pending = findCustomMonsterByName(customMonsters, pendingSelection?.name);
	if (pending) return pending;
	if (!currentSelection || !isCustomSource(currentSelection.source)) return null;
	return (
		customMonsters.find((monster) =>
			isSameMonsterIdentity(monster, currentSelection),
		) ?? null
	);
}

export function parseImportedCustomMonsters(raw: string): BestiaryMonster[] {
	const parsed: unknown = JSON.parse(raw);
	return getMonsterListFromResponse(parsed).map((monster) => ({
		...monster,
		name: monster.name.trim(),
		source: "CUSTOM",
	}));
}

export function mergeImportedCustomMonsters(
	current: BestiaryMonster[],
	imported: BestiaryMonster[],
): BestiaryMonster[] {
	const byName = new Map(
		current.map((monster) => [normalizeMonsterName(monster.name), monster]),
	);
	for (const monster of imported) {
		byName.set(normalizeMonsterName(monster.name), monster);
	}
	return [...byName.values()];
}

export function getNextBestiarySortOrder(
	current: BestiarySortOrder,
): BestiarySortOrder {
	if (current === "none") return "desc";
	if (current === "desc") return "asc";
	return "none";
}
