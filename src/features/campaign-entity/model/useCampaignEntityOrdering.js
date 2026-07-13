import { useCallback, useRef } from "react";

import { campaignApi } from "../../../entities/campaign/index.js";
import { updateCampaignEntity } from "./createEntity.js";

export const withEntityOrder = (items = []) =>
	items.map((item, index) => ({ ...item, order: index }));

export function useCampaignEntityOrdering({
	campaignSlug,
	characters,
	npcs,
	setCharacters,
	setNpcs,
	setLocations,
	sanitizeForSave,
	sanitizeLoaded,
	clearPendingSave,
	reloadCharacters,
	reloadNpcs,
	reloadLocations,
	pushUndo,
	onReorderError,
	onMoveError,
}) {
	const reorderUndoPushedRef = useRef(false);

	const reorder = useCallback(
		(setEntities) => (nextEntities) => {
			if (!reorderUndoPushedRef.current) {
				pushUndo();
				reorderUndoPushedRef.current = true;
			}
			setEntities(nextEntities);
		},
		[pushUndo],
	);
	const finishTrackedReorder = useCallback(() => {
		reorderUndoPushedRef.current = false;
	}, []);

	const persistReorder = useCallback(
		async (type, nextEntities = []) => {
			const orderedEntities = withEntityOrder(nextEntities).map(sanitizeForSave);
			reorderUndoPushedRef.current = false;
			const setters = {
				characters: setCharacters,
				npc: setNpcs,
				locations: setLocations,
			};
			const reloaders = {
				characters: reloadCharacters,
				npc: reloadNpcs,
				locations: reloadLocations,
			};
			setters[type]?.(orderedEntities);

			try {
				await campaignApi.replaceEntities(campaignSlug, type, orderedEntities);
			} catch (error) {
				onReorderError?.(error, type);
				await reloaders[type]?.();
			}
		},
		[
			campaignSlug,
			onReorderError,
			reloadCharacters,
			reloadLocations,
			reloadNpcs,
			sanitizeForSave,
			setCharacters,
			setLocations,
			setNpcs,
		],
	);

	const moveBetweenCharacterTypes = useCallback(
		async ({ sourceType, targetType, id }) => {
			if (
				!id ||
				sourceType === targetType ||
				!["characters", "npc"].includes(sourceType) ||
				!["characters", "npc"].includes(targetType)
			) {
				return;
			}

			const sourceList = sourceType === "characters" ? characters : npcs;
			const entity = sourceList.find((item) => item.id === id);
			if (!entity?.slug) return;

			clearPendingSave(sourceType, id);
			try {
				await updateCampaignEntity(
					campaignSlug,
					sourceType,
					entity.slug,
					sanitizeForSave(entity),
				);
				const moved = sanitizeLoaded(
					await campaignApi.moveEntity(
						campaignSlug,
						sourceType,
						entity.slug,
						targetType,
					),
				);

				if (sourceType === "characters") {
					setCharacters((current) => current.filter((item) => item.id !== id));
					setNpcs((current) => [...current, moved]);
				} else {
					setNpcs((current) => current.filter((item) => item.id !== id));
					setCharacters((current) => [...current, moved]);
				}
			} catch (error) {
				onMoveError?.(error);
				await Promise.all([reloadCharacters(), reloadNpcs()]);
			}
		},
		[
			campaignSlug,
			characters,
			clearPendingSave,
			npcs,
			onMoveError,
			reloadCharacters,
			reloadNpcs,
			sanitizeForSave,
			sanitizeLoaded,
			setCharacters,
			setNpcs,
		],
	);

	return {
		finishTrackedReorder,
		moveBetweenCharacterTypes,
		persistReorder,
		reorderCharacters: reorder(setCharacters),
		reorderLocations: reorder(setLocations),
		reorderNpcs: reorder(setNpcs),
	};
}
