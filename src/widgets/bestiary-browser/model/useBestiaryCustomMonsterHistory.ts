import {
	useMemo,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import {
	bestiaryApi,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	addUndoSnapshot,
	clearRedoStack,
	createRedoTransition,
	createUndoTransition,
	lang,
} from "../../../shared/lib/index.js";
import {
	cloneCustomMonsters,
	getCustomBestiaryUpdatePlan,
	isCustomSource,
	type CustomBestiaryUpdateOptions,
} from "./bestiaryBrowser.ts";

interface ApplyCustomMonsterListOptions {
	selectedName?: string;
	clearSelection?: boolean;
}

interface Message {
	title: string;
	message: string;
}

interface Options {
	allMonsters: BestiaryMonster[];
	selectedMonsterRef: MutableRefObject<BestiaryMonster | null>;
	setAllMonsters: Dispatch<SetStateAction<BestiaryMonster[]>>;
	setReloadToken: Dispatch<SetStateAction<number>>;
	setSelectedMonster: Dispatch<SetStateAction<BestiaryMonster | null>>;
	shouldAutoSelectMonsterRef: MutableRefObject<boolean>;
	showMessage(message: Message): void;
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export function useBestiaryCustomMonsterHistory({
	allMonsters,
	selectedMonsterRef,
	setAllMonsters,
	setReloadToken,
	setSelectedMonster,
	shouldAutoSelectMonsterRef,
	showMessage,
}: Options) {
	const [undoStack, setUndoStack] = useState<BestiaryMonster[][]>([]);
	const [redoStack, setRedoStack] = useState<BestiaryMonster[][]>([]);
	const customMonsters = useMemo(
		() => allMonsters.filter((monster) => isCustomSource(monster.source)),
		[allMonsters],
	);

	const pushCustomUndoSnapshot = (snapshot: BestiaryMonster[]) => {
		setUndoStack((current) =>
			addUndoSnapshot(current, snapshot, cloneCustomMonsters),
		);
		setRedoStack(clearRedoStack());
	};

	const pushCustomUndo = () => {
		pushCustomUndoSnapshot(customMonsters);
	};

	const applyCustomMonsterList = (
		nextCustomMonsters: BestiaryMonster[],
		options: ApplyCustomMonsterListOptions = {},
	) => {
		const selectedName = options.selectedName;
		const nextSelected = selectedName
			? nextCustomMonsters.find((monster) => monster.name === selectedName)
			: null;
		setAllMonsters((current) => [
			...current.filter((item) => !isCustomSource(item.source)),
			...nextCustomMonsters,
		]);
		if (nextSelected) {
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = nextSelected;
			setSelectedMonster(nextSelected);
		} else if (options.clearSelection) {
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = null;
			setSelectedMonster(null);
		}
	};

	const restoreCustomMonsters = async (
		nextCustomMonsters: BestiaryMonster[],
		options: ApplyCustomMonsterListOptions = {},
	): Promise<BestiaryMonster[]> => {
		const updated = await bestiaryApi.replaceCustomBestiaryMonsters(
			nextCustomMonsters,
		);
		const normalized = Array.isArray(updated) ? updated : [];
		applyCustomMonsterList(normalized, options);
		return normalized;
	};

	const handleUndo = async () => {
		if (undoStack.length === 0) return;
		const transition = createUndoTransition({
			undoStack,
			redoStack,
			current: customMonsters,
			clone: cloneCustomMonsters,
		});
		if (!transition.target) return;
		try {
			await restoreCustomMonsters(transition.target, { clearSelection: true });
			setUndoStack(transition.undoStack);
			setRedoStack(transition.redoStack);
		} catch (error) {
			showMessage({
				title: lang.t("Undo error"),
				message: getErrorMessage(error, lang.t("Unknown error")),
			});
		}
	};

	const handleRedo = async () => {
		if (redoStack.length === 0) return;
		const transition = createRedoTransition({
			undoStack,
			redoStack,
			current: customMonsters,
			clone: cloneCustomMonsters,
		});
		if (!transition.target) return;
		try {
			await restoreCustomMonsters(transition.target, { clearSelection: true });
			setRedoStack(transition.redoStack);
			setUndoStack(transition.undoStack);
		} catch (error) {
			showMessage({
				title: lang.t("Redo error"),
				message: getErrorMessage(error, lang.t("Unknown error")),
			});
		}
	};

	const handleCustomBestiaryUpdate = (
		updated: unknown,
		options: CustomBestiaryUpdateOptions = {},
	) => {
		const plan = getCustomBestiaryUpdatePlan(updated, options);
		if (plan.trackUndo) {
			pushCustomUndo();
		}

		shouldAutoSelectMonsterRef.current = false;
		if (plan.hasUpdatedMonsters) {
			setAllMonsters((current) => [
				...current.filter((item) => !isCustomSource(item.source)),
				...plan.updatedMonsters,
			]);
		}
		if (plan.nextSelectedMonster) {
			selectedMonsterRef.current = plan.nextSelectedMonster;
			setSelectedMonster(plan.nextSelectedMonster);
		}
		setReloadToken((value) => value + 1);
	};

	return {
		customMonsters,
		handleCustomBestiaryUpdate,
		handleRedo,
		handleUndo,
		pushCustomUndoSnapshot,
		redoStack,
		restoreCustomMonsters,
		undoStack,
	};
}
