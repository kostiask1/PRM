import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import {
	isCustomSource,
	normalizeMonsterName,
	normalizeMonsterSource,
} from "./bestiaryBrowserFiltering.ts";

export interface MonsterReference {
	name: string;
	source: string;
}

export interface BestiarySelectionPlan {
	monster: BestiaryMonster;
	explicit: boolean;
}

export interface BestiaryInitialSelectionScrollPlan {
	scrollKey: string;
	selectedIndex: number;
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

function haveSameMonsterName(
	left: BestiaryMonster | null | undefined,
	right: BestiaryMonster | null | undefined,
): boolean {
	const leftName = normalizeMonsterName(left?.name);
	const rightName = normalizeMonsterName(right?.name);
	return Boolean(leftName) && leftName === rightName;
}

function haveSameMonsterSource(
	left: BestiaryMonster | null | undefined,
	right: BestiaryMonster | null | undefined,
): boolean {
	return normalizeMonsterSource(left?.source) === normalizeMonsterSource(right?.source);
}

export function isSameMonsterIdentity(
	left: BestiaryMonster | null | undefined,
	right: BestiaryMonster | null | undefined,
): boolean {
	if (!haveSameMonsterName(left, right)) return false;
	return haveSameMonsterSource(left, right);
}

function monsterNameMatchesReference(
	monster: BestiaryMonster | null | undefined,
	reference: MonsterReference,
): boolean {
	return normalizeMonsterName(monster?.name) === normalizeMonsterName(reference.name);
}

function monsterSourceMatchesReference(
	monster: BestiaryMonster | null | undefined,
	reference: MonsterReference,
): boolean {
	const source = normalizeMonsterSource(reference.source);
	if (!source) return true;
	return normalizeMonsterSource(monster?.source) === source;
}

export function monsterMatchesReference(
	monster: BestiaryMonster | null | undefined,
	reference: MonsterReference | null | undefined,
): boolean {
	if (!reference) return false;
	if (!monsterNameMatchesReference(monster, reference)) return false;
	return monsterSourceMatchesReference(monster, reference);
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

function canScrollToInitialBestiarySelection(
	enabled: boolean,
	reference: MonsterReference,
	selectedMonster: BestiaryMonster | null | undefined,
): selectedMonster is BestiaryMonster {
	return Boolean(
		enabled &&
			reference.name &&
			selectedMonster?.name &&
			monsterMatchesReference(selectedMonster, reference),
	);
}

export function getBestiaryInitialSelectionScrollPlan(
	displayedMonsters: BestiaryMonster[],
	reference: MonsterReference,
	selectedMonster: BestiaryMonster | null | undefined,
	enabled: boolean,
	lastScrollKey: string,
): BestiaryInitialSelectionScrollPlan | null {
	if (!canScrollToInitialBestiarySelection(enabled, reference, selectedMonster)) {
		return null;
	}
	const scrollKey = `${selectedMonster.source || ""}:${selectedMonster.name}`;
	if (lastScrollKey === scrollKey) return null;
	const selectedIndex = getMonsterListIndex(displayedMonsters, selectedMonster);
	return selectedIndex < 0 ? null : { scrollKey, selectedIndex };
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

function getPendingCustomRefreshSelection(
	customMonsters: BestiaryMonster[],
	pendingSelection: MonsterReference | null | undefined,
): BestiaryMonster | null {
	return findCustomMonsterByName(customMonsters, pendingSelection?.name);
}

function getCurrentCustomRefreshSelection(
	customMonsters: BestiaryMonster[],
	currentSelection: BestiaryMonster | null | undefined,
): BestiaryMonster | null {
	if (!currentSelection || !isCustomSource(currentSelection.source)) return null;
	return (
		customMonsters.find((monster) =>
			isSameMonsterIdentity(monster, currentSelection),
		) ?? null
	);
}

export function getCustomRefreshSelection(
	customMonsters: BestiaryMonster[],
	pendingSelection: MonsterReference | null | undefined,
	currentSelection: BestiaryMonster | null | undefined,
): BestiaryMonster | null {
	const pending = getPendingCustomRefreshSelection(
		customMonsters,
		pendingSelection,
	);
	if (pending) return pending;
	return getCurrentCustomRefreshSelection(customMonsters, currentSelection);
}
