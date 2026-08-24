import {
	useState,
	type ChangeEvent,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import {
	bestiaryApi,
	MonsterStatBlockModel,
	type BestiaryFavorite,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { downloadJsonFile, lang } from "../../../shared/lib/index.js";
import {
	cloneCustomMonsters,
	executeBestiaryFieldEditSave,
	getBestiaryFieldEditStartPlan,
	getCreateBasedMonsterPlan,
	getCustomMonsterDeleteStartPlan,
	getEditedCustomMonsterPayload,
	getMonsterListFromResponse,
	isCustomSource,
	mergeImportedCustomMonsters,
	normalizeMonsterName,
	parseImportedCustomMonsters,
	removeDeletedCustomMonsterFavorite,
	replaceDeletedCustomMonsterList,
	type BestiaryFieldEditMode,
} from "./bestiaryBrowser.ts";

interface Message {
	title: string;
	message: string;
}

interface Options {
	customMonsters: BestiaryMonster[];
	onPushCustomUndoSnapshot(snapshot: BestiaryMonster[]): void;
	onRestoreCustomMonsters(
		nextCustomMonsters: BestiaryMonster[],
		options?: { selectedName?: string; clearSelection?: boolean },
	): Promise<BestiaryMonster[]>;
	requestConfirmation(options: Message): Promise<boolean>;
	selectedMonsterRef: MutableRefObject<BestiaryMonster | null>;
	setAllMonsters: Dispatch<SetStateAction<BestiaryMonster[]>>;
	setFavorites: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	setSelectedMonster: Dispatch<SetStateAction<BestiaryMonster | null>>;
	shouldAutoSelectMonsterRef: MutableRefObject<boolean>;
	showMessage(message: Message): void;
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export function useBestiaryCustomMonsterEditing({
	customMonsters,
	onPushCustomUndoSnapshot,
	onRestoreCustomMonsters,
	requestConfirmation,
	selectedMonsterRef,
	setAllMonsters,
	setFavorites,
	setSelectedMonster,
	shouldAutoSelectMonsterRef,
	showMessage,
}: Options) {
	const [fieldEditingMonster, setFieldEditingMonster] =
		useState<BestiaryMonster | null>(null);
	const [fieldEditingMode, setFieldEditingMode] =
		useState<BestiaryFieldEditMode>("edit");
	const [fieldEditingOriginalMonster, setFieldEditingOriginalMonster] =
		useState<BestiaryMonster | null>(null);

	const openEditMonster = (monster: BestiaryMonster) => {
		const plan = getBestiaryFieldEditStartPlan(
			monster,
			lang.t("Creature"),
			(target) => new MonsterStatBlockModel(target).localTokenSrc,
		);
		if (plan.kind === "skip") return;
		setFieldEditingMode(plan.mode);
		setFieldEditingOriginalMonster(plan.originalMonster);
		setFieldEditingMonster(plan.draftMonster);
	};

	const closeEditCustomMonster = () => {
		setFieldEditingMonster(null);
		setFieldEditingMode("edit");
		setFieldEditingOriginalMonster(null);
	};

	const applyUpdatedCustomMonster = (
		previousName: string,
		updatedMonster: BestiaryMonster,
	) => {
		onPushCustomUndoSnapshot(cloneCustomMonsters(customMonsters));
		shouldAutoSelectMonsterRef.current = false;
		setAllMonsters((current) => [
			...current.filter(
				(item) =>
					!isCustomSource(item.source) ||
					!(item.name === previousName || item.name === updatedMonster.name),
			),
			updatedMonster,
		]);
		setSelectedMonster(updatedMonster);
		selectedMonsterRef.current = updatedMonster;
		if (previousName !== updatedMonster.name) {
			setFavorites((current) =>
				current.map((favorite) =>
					favorite.name === previousName && isCustomSource(favorite.source)
						? { ...favorite, name: updatedMonster.name, source: "CUSTOM" }
						: favorite,
				),
			);
		}
	};

	const createBasedCustomMonster = async (
		draftMonster: BestiaryMonster,
	): Promise<BestiaryMonster> => {
		const storedCustomMonsters = getMonsterListFromResponse(
			await bestiaryApi.getCustomBestiaryData(),
		);
		const originalModel = new MonsterStatBlockModel(
			fieldEditingOriginalMonster ?? {},
		);
		const plan = getCreateBasedMonsterPlan(
			storedCustomMonsters,
			draftMonster,
			fieldEditingOriginalMonster,
			originalModel.localTokenSrc,
		);
		if (plan.duplicate) {
			throw new Error(lang.t("Custom creature with this name already exists."));
		}
		const updated = await bestiaryApi.replaceCustomBestiaryMonsters([
			...storedCustomMonsters,
			plan.monster,
		]);
		return (
			(updated ?? []).find(
				(monster) => normalizeMonsterName(monster.name) === plan.normalizedName,
			) ?? plan.monster
		);
	};

	const updateEditedCustomMonster = async (
		draftMonster: BestiaryMonster,
		editingMonster: BestiaryMonster,
	): Promise<BestiaryMonster> => {
		const updated = await bestiaryApi.updateCustomBestiaryMonster(
			String(editingMonster.id || editingMonster.name),
			{
				monster: getEditedCustomMonsterPayload(
					draftMonster,
					editingMonster,
					fieldEditingOriginalMonster,
				),
			},
		);
		if (!updated) throw new Error(lang.t("Empty custom creature response."));
		return updated;
	};

	const saveEditedCustomMonster = async (draftMonster: BestiaryMonster) => {
		await executeBestiaryFieldEditSave({
			draftMonster,
			editingMonster: fieldEditingMonster,
			mode: fieldEditingMode,
			createBased: createBasedCustomMonster,
			update: updateEditedCustomMonster,
			onApplied: applyUpdatedCustomMonster,
			onClose: closeEditCustomMonster,
			onError: (error) =>
				showMessage({
					title: lang.t("Error"),
					message: getErrorMessage(error, lang.t("Unknown error")),
				}),
		});
	};

	const handleDeleteCustomMonster = async (monster: BestiaryMonster) => {
		const startPlan = getCustomMonsterDeleteStartPlan(monster);
		if (startPlan.kind === "skip") return;
		const confirmed = await requestConfirmation({
			title: lang.t("Delete custom creature"),
			message: lang.t('Delete custom creature "{name}"?', {
				name: startPlan.monsterName,
			}),
		});
		if (!confirmed) return;

		const undoSnapshot = cloneCustomMonsters(customMonsters);
		try {
			const updatedCustomMonsters = await bestiaryApi.deleteCustomBestiaryMonster(
				startPlan.monsterName,
			);
			onPushCustomUndoSnapshot(undoSnapshot);
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = null;
			setSelectedMonster(null);
			setAllMonsters((current) =>
				replaceDeletedCustomMonsterList(current, updatedCustomMonsters),
			);
			setFavorites((current) =>
				removeDeletedCustomMonsterFavorite(current, startPlan.monsterName),
			);
		} catch (error) {
			showMessage({
				title: lang.t("Delete error"),
				message: getErrorMessage(error, lang.t("Unknown error")),
			});
		}
	};

	const handleExportCustomMonsters = () => {
		downloadJsonFile(
			{
				version: 1,
				type: "custom-bestiary",
				exportedAt: new Date().toISOString(),
				monster: customMonsters,
			},
			`custom-bestiary-${new Date().toISOString().slice(0, 10)}.json`,
		);
	};

	const handleImportCustomMonsters = async (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		try {
			const raw = await file.text();
			const validImported = parseImportedCustomMonsters(raw);
			if (validImported.length === 0) {
				throw new Error(lang.t("No custom creatures found in file."));
			}
			const undoSnapshot = cloneCustomMonsters(customMonsters);
			await onRestoreCustomMonsters(
				mergeImportedCustomMonsters(customMonsters, validImported),
				{ selectedName: validImported[0].name },
			);
			onPushCustomUndoSnapshot(undoSnapshot);
			showMessage({
				title: lang.t("Import custom creatures"),
				message: lang.t("Imported custom creatures: {count}", {
					count: validImported.length,
				}),
			});
		} catch (error) {
			showMessage({
				title: lang.t("Import error"),
				message: getErrorMessage(error, lang.t("Unknown error")),
			});
		}
	};

	return {
		closeEditCustomMonster,
		fieldEditingMode,
		fieldEditingMonster,
		handleDeleteCustomMonster,
		handleExportCustomMonsters,
		handleImportCustomMonsters,
		openEditMonster,
		saveEditedCustomMonster,
	};
}
