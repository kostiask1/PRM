import { useEffect, useRef, type RefObject } from "react";
import type ReactList from "react-list";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { isSameMonsterIdentity } from "../model.js";

export interface UseBestiaryMobileSelectionOptions {
	displayedMonsters: BestiaryMonster[];
	listRef: RefObject<ReactList>;
	selectedMonster: BestiaryMonster | null;
	setSelectedMonster: (monster: BestiaryMonster | null) => void;
}

function isMobileViewport() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(max-width: 767px)").matches
	);
}

export function useBestiaryMobileSelection({
	displayedMonsters,
	listRef,
	selectedMonster,
	setSelectedMonster,
}: UseBestiaryMobileSelectionOptions) {
	const detailRef = useRef<HTMLDivElement>(null);

	const handleSelectMonster = (monster: BestiaryMonster | null) => {
		setSelectedMonster(monster);
		if (!monster?.name || !isMobileViewport()) return;

		requestAnimationFrame(() => {
			detailRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	};

	useEffect(() => {
		if (!selectedMonster?.name || !isMobileViewport()) return undefined;
		const selectedIndex = displayedMonsters.findIndex((monster) =>
			isSameMonsterIdentity(monster, selectedMonster),
		);
		if (selectedIndex < 0) return undefined;

		const frameId = requestAnimationFrame(() => {
			listRef.current?.scrollTo(selectedIndex);
		});
		return () => cancelAnimationFrame(frameId);
	}, [displayedMonsters, listRef, selectedMonster]);

	return { detailRef, handleSelectMonster };
}
