import { useCallback, useEffect, useRef, useState } from "react";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { monsterMatchesReference, parseMonsterReference } from "../model.js";

export interface UseBestiaryMonsterSelectionStateOptions {
	initialSelectedName: string;
	initialSelectedSource: string;
	onActiveMonsterChange: ((monster: BestiaryMonster) => void) | null;
}

export function useBestiaryMonsterSelectionState({
	initialSelectedName,
	initialSelectedSource,
	onActiveMonsterChange,
}: UseBestiaryMonsterSelectionStateOptions) {
	const [selectedMonster, setSelectedMonster] =
		useState<BestiaryMonster | null>(null);
	const selectedMonsterRef = useRef<BestiaryMonster | null>(null);
	const shouldAutoSelectMonsterRef = useRef(true);
	const embeddedScrolledMonsterRef = useRef("");

	useEffect(() => {
		selectedMonsterRef.current = selectedMonster;
	}, [selectedMonster]);

	useEffect(() => {
		if (
			selectedMonsterRef.current?.name &&
			initialSelectedName &&
			monsterMatchesReference(
				selectedMonsterRef.current,
				parseMonsterReference(initialSelectedName, initialSelectedSource),
			)
		) {
			return;
		}
		embeddedScrolledMonsterRef.current = "";
	}, [initialSelectedName, initialSelectedSource]);

	const selectMonster = useCallback(
		(monster: BestiaryMonster | null) => {
			shouldAutoSelectMonsterRef.current = false;
			if (monster?.name) {
				embeddedScrolledMonsterRef.current = `${monster.source || ""}:${monster.name}`;
			}
			setSelectedMonster(monster);
			if (monster?.name) {
				onActiveMonsterChange?.(monster);
			}
		},
		[onActiveMonsterChange],
	);

	return {
		embeddedScrolledMonsterRef,
		selectedMonster,
		selectedMonsterRef,
		selectMonster,
		setSelectedMonster,
		shouldAutoSelectMonsterRef,
	};
}
