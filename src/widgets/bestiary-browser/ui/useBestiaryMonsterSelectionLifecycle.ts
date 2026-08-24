import {
	useEffect,
	useMemo,
	type Dispatch,
	type MutableRefObject,
	type RefObject,
	type SetStateAction,
} from "react";
import type ReactList from "react-list";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import {
	getBestiaryInitialSelectionScrollPlan,
	getBestiarySelectionPlan,
	isSameMonsterIdentity,
	parseMonsterReference,
} from "../model.js";

export interface UseBestiaryMonsterSelectionLifecycleOptions {
	allMonsters: BestiaryMonster[];
	displayedMonsters: BestiaryMonster[];
	embeddedScrolledMonsterRef: MutableRefObject<string>;
	initialSelectedName: string;
	initialSelectedSource: string;
	listRef: RefObject<ReactList>;
	scrollToInitialSelected: boolean;
	selectedMonster: BestiaryMonster | null;
	selectedMonsterRef: MutableRefObject<BestiaryMonster | null>;
	setSelectedMonster: Dispatch<SetStateAction<BestiaryMonster | null>>;
	shouldAutoSelectMonsterRef: MutableRefObject<boolean>;
}

export function useBestiaryMonsterSelectionLifecycle({
	allMonsters,
	displayedMonsters,
	embeddedScrolledMonsterRef,
	initialSelectedName,
	initialSelectedSource,
	listRef,
	scrollToInitialSelected,
	selectedMonster,
	selectedMonsterRef,
	setSelectedMonster,
	shouldAutoSelectMonsterRef,
}: UseBestiaryMonsterSelectionLifecycleOptions) {
	const initialMonsterReference = useMemo(
		() => parseMonsterReference(initialSelectedName, initialSelectedSource),
		[initialSelectedName, initialSelectedSource],
	);

	useEffect(() => {
		const plan = getBestiarySelectionPlan(
			displayedMonsters,
			allMonsters,
			initialMonsterReference,
			selectedMonsterRef.current,
			shouldAutoSelectMonsterRef.current,
		);
		if (!plan) return;
		if (isSameMonsterIdentity(selectedMonsterRef.current, plan.monster)) return;
		if (plan.explicit) shouldAutoSelectMonsterRef.current = false;
		selectedMonsterRef.current = plan.monster;
		setSelectedMonster(plan.monster);
	}, [
		allMonsters,
		displayedMonsters,
		initialMonsterReference,
		selectedMonsterRef,
		setSelectedMonster,
		shouldAutoSelectMonsterRef,
	]);

	useEffect(() => {
		const plan = getBestiaryInitialSelectionScrollPlan(
			displayedMonsters,
			initialMonsterReference,
			selectedMonster,
			scrollToInitialSelected,
			embeddedScrolledMonsterRef.current,
		);
		if (!plan) return undefined;

		embeddedScrolledMonsterRef.current = plan.scrollKey;
		const frameId = requestAnimationFrame(() => {
			listRef.current?.scrollTo(plan.selectedIndex);
		});
		return () => cancelAnimationFrame(frameId);
	}, [
		displayedMonsters,
		embeddedScrolledMonsterRef,
		initialMonsterReference,
		listRef,
		scrollToInitialSelected,
		selectedMonster,
	]);
}
