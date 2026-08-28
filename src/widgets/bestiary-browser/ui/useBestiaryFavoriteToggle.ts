import { type Dispatch, type SetStateAction } from "react";
import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";

export interface UseBestiaryFavoriteToggleOptions {
	setFavorites: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	toggleFavorite(name: string, source: string): Promise<BestiaryFavorite[] | null>;
}

export function useBestiaryFavoriteToggle({
	setFavorites,
	toggleFavorite,
}: UseBestiaryFavoriteToggleOptions) {
	const handleToggleFavorite = async (monster: BestiaryMonster) => {
		try {
			const newFavs = await toggleFavorite(
				monster.name,
				String(monster.source ?? ""),
			);
			setFavorites(newFavs ?? []);
		} catch (err) {
			console.error("Failed to toggle favorite", err);
		}
	};

	return { handleToggleFavorite };
}
