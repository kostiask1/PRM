import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import {
	isCustomSource,
	normalizeMonsterName,
} from "./bestiaryBrowserFiltering.ts";

export interface CreateBasedMonsterPlan {
	duplicate: boolean;
	normalizedName: string;
	monster: BestiaryMonster;
}

export type BestiaryFieldEditStartPlan =
	| { kind: "skip" }
	| {
			kind: "ready";
			mode: "edit" | "create-based";
			originalMonster: BestiaryMonster;
			draftMonster: BestiaryMonster;
	  };

export type BestiaryFieldEditMode = "edit" | "create-based";

export type BestiaryFieldEditSaveOutcome =
	| { status: "skipped" }
	| { status: "succeeded"; updatedMonster: BestiaryMonster }
	| { status: "failed"; error: unknown };

export interface ExecuteBestiaryFieldEditSaveOptions {
	draftMonster: BestiaryMonster;
	editingMonster: BestiaryMonster | null;
	mode: BestiaryFieldEditMode;
	createBased(draftMonster: BestiaryMonster): Promise<BestiaryMonster>;
	update(
		draftMonster: BestiaryMonster,
		editingMonster: BestiaryMonster,
	): Promise<BestiaryMonster>;
	onApplied(previousName: string, updatedMonster: BestiaryMonster): void;
	onClose(): void;
	onError(error: unknown): void;
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

function hasBestiaryFieldEditTarget(
	monster: BestiaryMonster | null,
): monster is BestiaryMonster {
	return Boolean(monster?.name);
}

function getBestiaryFieldEditImageUrl(
	monster: BestiaryMonster,
	getLocalTokenSrc: (monster: BestiaryMonster) => string,
): string {
	if (typeof monster.imageUrl === "string" && monster.imageUrl) {
		return monster.imageUrl;
	}
	return getLocalTokenSrc(monster);
}

function getCustomBestiaryFieldEditPlan(
	monster: BestiaryMonster,
): BestiaryFieldEditStartPlan {
	return {
		kind: "ready",
		mode: "edit",
		originalMonster: monster,
		draftMonster: monster,
	};
}

function getOfficialBestiaryFieldEditPlan(
	monster: BestiaryMonster,
	fallbackName: string,
	getLocalTokenSrc: (monster: BestiaryMonster) => string,
): BestiaryFieldEditStartPlan {
	return {
		kind: "ready",
		mode: "create-based",
		originalMonster: monster,
		draftMonster: {
			...monster,
			name: monster.name || fallbackName,
			source: "CUSTOM",
			imageUrl: getBestiaryFieldEditImageUrl(monster, getLocalTokenSrc),
		},
	};
}

export function getBestiaryFieldEditStartPlan(
	monster: BestiaryMonster | null,
	fallbackName: string,
	getLocalTokenSrc: (monster: BestiaryMonster) => string,
): BestiaryFieldEditStartPlan {
	if (!hasBestiaryFieldEditTarget(monster)) return { kind: "skip" };
	return isCustomSource(monster.source)
		? getCustomBestiaryFieldEditPlan(monster)
		: getOfficialBestiaryFieldEditPlan(
				monster,
				fallbackName,
				getLocalTokenSrc,
			);
}

function saveBestiaryFieldEditMonster(
	options: ExecuteBestiaryFieldEditSaveOptions,
	editingMonster: BestiaryMonster,
): Promise<BestiaryMonster> {
	return options.mode === "create-based"
		? options.createBased(options.draftMonster)
		: options.update(options.draftMonster, editingMonster);
}

function getBestiaryFieldEditPreviousName(
	mode: BestiaryFieldEditMode,
	editingMonster: BestiaryMonster,
): string {
	return mode === "create-based" ? "" : editingMonster.name;
}

export async function executeBestiaryFieldEditSave(
	options: ExecuteBestiaryFieldEditSaveOptions,
): Promise<BestiaryFieldEditSaveOutcome> {
	const editingMonster = options.editingMonster;
	if (!editingMonster?.name) return { status: "skipped" };
	try {
		const updatedMonster = await saveBestiaryFieldEditMonster(
			options,
			editingMonster,
		);
		options.onApplied(
			getBestiaryFieldEditPreviousName(options.mode, editingMonster),
			updatedMonster,
		);
		options.onClose();
		return { status: "succeeded", updatedMonster };
	} catch (error) {
		options.onError(error);
		return { status: "failed", error };
	}
}
