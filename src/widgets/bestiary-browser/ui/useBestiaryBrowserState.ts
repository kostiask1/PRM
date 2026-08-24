import { useRef, useState } from "react";
import type ReactList from "react-list";
import type {
	BestiaryFavorite,
	BestiaryMonster,
	LegendaryGroup,
} from "../../../entities/bestiary/index.js";
import type { MonsterReference } from "../model.js";

export function useBestiaryBrowserState() {
	const [sources, setSources] = useState<string[]>([]);
	const [allMonsters, setAllMonsters] = useState<BestiaryMonster[]>([]);
	const [loading, setLoading] = useState(false);
	const [legendaryGroups, setLegendaryGroups] = useState<LegendaryGroup[]>([]);
	const [favorites, setFavorites] = useState<BestiaryFavorite[]>([]);
	const [reloadToken, setReloadToken] = useState(0);
	const listRef = useRef<ReactList>(null);
	const aiDraftResponseRef = useRef<HTMLDivElement>(null);
	const openImagePromptForMonsterRef = useRef<
		((monster: BestiaryMonster) => void) | null
	>(null);
	const pendingSyncSelectionRef = useRef<MonsterReference | null>(null);
	const hasLoadedInitialMonstersRef = useRef(false);

	return {
		sources,
		setSources,
		allMonsters,
		setAllMonsters,
		loading,
		setLoading,
		legendaryGroups,
		setLegendaryGroups,
		favorites,
		setFavorites,
		reloadToken,
		setReloadToken,
		listRef,
		aiDraftResponseRef,
		openImagePromptForMonsterRef,
		pendingSyncSelectionRef,
		hasLoadedInitialMonstersRef,
	};
}
