import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	getMonsterCrDisplay,
	isCustomSource,
} from "./bestiaryBrowserFiltering.ts";
import { isSameMonsterIdentity } from "./bestiaryBrowserSelection.ts";

export type BestiaryMonsterRowPrimaryAction = "select" | "add" | null;

export interface BestiaryMonsterRowPresentation {
	crDisplay: string | number;
	favoriteTitleKey: "Add to favorites" | "Remove from favorites";
	isCustom: boolean;
	isFavorite: boolean;
	isSelected: boolean;
	nextSelection: BestiaryMonster | null;
	primaryAction: BestiaryMonsterRowPrimaryAction;
	primaryTitleKey: "Add to encounter" | "Insert" | null;
	tokenSrc: string;
}

type BestiaryMonsterAction = (monster: BestiaryMonster) => void;

interface BestiaryDetailPresentation {
	monster: BestiaryMonster;
	favoriteActive: boolean;
	insertAction: BestiaryMonsterAction | undefined;
	addAction: BestiaryMonsterAction | undefined;
	addTitle: string | undefined;
	showAddToEncounterPicker: boolean;
	deleteAction: BestiaryMonsterAction | undefined;
}

function isFavoriteMonster(
	favorites: BestiaryFavorite[],
	monster: BestiaryMonster | null | undefined,
): boolean {
	return favorites.some((favorite) => isSameMonsterIdentity(favorite, monster));
}

function getBestiaryMonsterRowPrimaryAction(
	hasSelectAction: boolean,
	hasAddAction: boolean,
): BestiaryMonsterRowPrimaryAction {
	if (hasSelectAction) return "select";
	if (hasAddAction) return "add";
	return null;
}

function getBestiaryMonsterRowTokenSrc(
	monster: BestiaryMonster,
	fallbackTokenSrc: string,
): string {
	return typeof monster.imageUrl === "string"
		? monster.imageUrl
		: fallbackTokenSrc;
}

function getBestiaryMonsterRowCrDisplay(
	monster: BestiaryMonster,
): string | number {
	return getMonsterCrDisplay(monster) || "--";
}

function getBestiaryMonsterRowFavoriteTitle(
	isFavorite: boolean,
): BestiaryMonsterRowPresentation["favoriteTitleKey"] {
	return isFavorite ? "Remove from favorites" : "Add to favorites";
}

function getBestiaryMonsterRowNextSelection(
	monster: BestiaryMonster,
	isSelected: boolean,
): BestiaryMonster | null {
	return isSelected ? null : monster;
}

function getBestiaryMonsterRowPrimaryTitle(
	primaryAction: BestiaryMonsterRowPrimaryAction,
): BestiaryMonsterRowPresentation["primaryTitleKey"] {
	if (primaryAction === "select") return "Insert";
	if (primaryAction === "add") return "Add to encounter";
	return null;
}

export function getBestiaryMonsterRowPresentation(
	monster: BestiaryMonster,
	selectedMonster: BestiaryMonster | null,
	favorites: BestiaryFavorite[],
	hasSelectAction: boolean,
	hasAddAction: boolean,
	fallbackTokenSrc: string,
): BestiaryMonsterRowPresentation {
	const isSelected = isSameMonsterIdentity(selectedMonster, monster);
	const isFavorite = isFavoriteMonster(favorites, monster);
	const primaryAction = getBestiaryMonsterRowPrimaryAction(
		hasSelectAction,
		hasAddAction,
	);
	return {
		crDisplay: getBestiaryMonsterRowCrDisplay(monster),
		favoriteTitleKey: getBestiaryMonsterRowFavoriteTitle(isFavorite),
		isCustom: isCustomSource(monster.source),
		isFavorite,
		isSelected,
		nextSelection: getBestiaryMonsterRowNextSelection(monster, isSelected),
		primaryAction,
		primaryTitleKey: getBestiaryMonsterRowPrimaryTitle(primaryAction),
		tokenSrc: getBestiaryMonsterRowTokenSrc(monster, fallbackTokenSrc),
	};
}

function normalizeBestiaryMonsterAction(
	action: BestiaryMonsterAction | null | undefined,
): BestiaryMonsterAction | undefined {
	return action ?? undefined;
}

function getBestiaryDetailAddTitle(
	action: BestiaryMonsterAction | null | undefined,
	getAddTitle: () => string,
): string | undefined {
	return action ? getAddTitle() : undefined;
}

function getBestiaryDetailDeleteAction(
	monster: BestiaryMonster,
	action: BestiaryMonsterAction | null | undefined,
): BestiaryMonsterAction | undefined {
	return isCustomSource(monster.source)
		? normalizeBestiaryMonsterAction(action)
		: undefined;
}

export function getBestiaryDetailPresentation(
	selectedMonster: BestiaryMonster | null,
	favorites: BestiaryFavorite[],
	onSelectMonster: BestiaryMonsterAction | null | undefined,
	onAddMonster: BestiaryMonsterAction | null | undefined,
	onDeleteCustomMonster: BestiaryMonsterAction | null | undefined,
	getAddTitle: () => string,
): BestiaryDetailPresentation | null {
	if (!selectedMonster) return null;
	return {
		monster: selectedMonster,
		favoriteActive: isFavoriteMonster(favorites, selectedMonster),
		insertAction: normalizeBestiaryMonsterAction(onSelectMonster),
		addAction: normalizeBestiaryMonsterAction(onAddMonster),
		addTitle: getBestiaryDetailAddTitle(onAddMonster, getAddTitle),
		showAddToEncounterPicker: Boolean(onAddMonster),
		deleteAction: getBestiaryDetailDeleteAction(
			selectedMonster,
			onDeleteCustomMonster,
		),
	};
}
