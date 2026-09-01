import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	isCustomSource,
	normalizeMonsterName,
} from "./bestiaryBrowserFiltering.ts";
import { findCustomMonsterByName } from "./bestiaryBrowserSelection.ts";

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

export type CustomMonsterDeleteStartPlan =
	| { kind: "skip" }
	| { kind: "ready"; monsterName: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function hasNamedBestiaryMonster(
	monster: BestiaryMonster | null,
): monster is BestiaryMonster {
	return Boolean(monster?.name);
}

export function getCustomMonsterDeleteStartPlan(
	monster: BestiaryMonster | null,
): CustomMonsterDeleteStartPlan {
	if (!hasNamedBestiaryMonster(monster)) return { kind: "skip" };
	if (!isCustomSource(monster.source)) return { kind: "skip" };
	return { kind: "ready", monsterName: monster.name };
}

export function replaceDeletedCustomMonsterList(
	currentMonsters: BestiaryMonster[],
	updatedCustomMonsters: unknown,
): BestiaryMonster[] {
	return [
		...currentMonsters.filter((monster) => !isCustomSource(monster.source)),
		...(Array.isArray(updatedCustomMonsters)
			? (updatedCustomMonsters as BestiaryMonster[])
			: []),
	];
}

export function removeDeletedCustomMonsterFavorite(
	favorites: BestiaryFavorite[],
	monsterName: string,
): BestiaryFavorite[] {
	return favorites.filter(
		(favorite) => !isDeletedCustomMonsterFavorite(favorite, monsterName),
	);
}

function isDeletedCustomMonsterFavorite(
	favorite: BestiaryFavorite,
	monsterName: string,
): boolean {
	return favorite.name === monsterName && isCustomSource(favorite.source);
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

function getUpdatedMonsterCollection(updated: unknown): {
	hasUpdatedMonsters: boolean;
	updatedMonsters: BestiaryMonster[];
} {
	const record = isRecord(updated) ? updated : null;
	if (!Array.isArray(record?.monsters)) {
		return { hasUpdatedMonsters: false, updatedMonsters: [] };
	}
	return {
		hasUpdatedMonsters: true,
		updatedMonsters: getMonsterListFromResponse({ monsters: record.monsters }),
	};
}

function getCustomBestiaryUpdateSelection(
	updatedMonsters: BestiaryMonster[],
	options: CustomBestiaryUpdateOptions,
): BestiaryMonster | null {
	const generatedMonsters = getMonsterListFromResponse(options.generated);
	return (
		getGeneratedMonsterSelection(updatedMonsters, generatedMonsters) ??
		getRequestedMonsterSelection(updatedMonsters, options.selectedName)
	);
}

function shouldTrackCustomBestiaryUpdate(
	hasUpdatedMonsters: boolean,
	trackUndo: boolean | undefined,
): boolean {
	return hasUpdatedMonsters && trackUndo !== false;
}

export function getCustomBestiaryUpdatePlan(
	updated: unknown,
	options: CustomBestiaryUpdateOptions = {},
): CustomBestiaryUpdatePlan {
	const { hasUpdatedMonsters, updatedMonsters } =
		getUpdatedMonsterCollection(updated);
	return {
		hasUpdatedMonsters,
		updatedMonsters,
		nextSelectedMonster: getCustomBestiaryUpdateSelection(
			updatedMonsters,
			options,
		),
		trackUndo: shouldTrackCustomBestiaryUpdate(
			hasUpdatedMonsters,
			options.trackUndo,
		),
	};
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
