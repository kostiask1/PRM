import { useCallback } from "react";
import { campaignApi } from "../../../entities/campaign/index.js";
import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import { updateCampaignEntity } from "./createEntity.ts";
import type {
	CampaignEntitySetter,
	CampaignFeatureEntity,
	CampaignFeatureEntityId,
	CampaignFeatureEntityType,
} from "./contracts.ts";

type CharacterEntityType = "characters" | "npc";
type OrderedEntityType = CharacterEntityType | "locations";

export const withEntityOrder = <T extends CampaignFeatureEntity>(
	items: T[] = [],
): T[] => items.map((item, index) => ({ ...item, order: index }));

interface MoveBetweenCharacterTypesOptions {
	sourceType: CharacterEntityType;
	targetType: CharacterEntityType;
	id: CampaignFeatureEntityId;
}

interface CampaignEntityOrderingOptions<T extends CampaignFeatureEntity> {
	campaignSlug: string;
	characters: T[];
	npcs: T[];
	setCharacters: CampaignEntitySetter<T>;
	setNpcs: CampaignEntitySetter<T>;
	setLocations: CampaignEntitySetter<T>;
	sanitizeForSave: (entity: T) => T;
	sanitizeLoaded: (entity: CampaignEntityRecord | null) => T;
	clearPendingSave: (
		type: CampaignFeatureEntityType,
		id: CampaignFeatureEntityId,
	) => void;
	reloadCharacters: () => void | Promise<void>;
	reloadNpcs: () => void | Promise<void>;
	reloadLocations: () => void | Promise<void>;
	onReorderError?: (error: unknown, type: OrderedEntityType) => void;
	onMoveError?: (error: unknown) => void;
}

export interface CampaignEntityOrdering<T extends CampaignFeatureEntity> {
	finishTrackedReorder: () => void;
	moveBetweenCharacterTypes: (
		options: MoveBetweenCharacterTypesOptions,
	) => Promise<void>;
	persistReorder: (type: OrderedEntityType, nextEntities?: T[]) => Promise<void>;
	reorderCharacters: (nextEntities: T[]) => void;
	reorderLocations: (nextEntities: T[]) => void;
	reorderNpcs: (nextEntities: T[]) => void;
}

export function useCampaignEntityOrdering<T extends CampaignFeatureEntity>({
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
	onReorderError,
	onMoveError,
}: CampaignEntityOrderingOptions<T>): CampaignEntityOrdering<T> {
	const reorder = useCallback(
		(setEntities: CampaignEntitySetter<T>) => (nextEntities: T[]) =>
			setEntities(nextEntities),
		[],
	);
	const finishTrackedReorder = useCallback(() => {}, []);

	const persistReorder = useCallback(
		async (type: OrderedEntityType, nextEntities: T[] = []) => {
			const orderedEntities = withEntityOrder(nextEntities).map(sanitizeForSave);
			const setters: Record<OrderedEntityType, CampaignEntitySetter<T>> = {
				characters: setCharacters,
				npc: setNpcs,
				locations: setLocations,
			};
			const reloaders: Record<OrderedEntityType, () => void | Promise<void>> = {
				characters: reloadCharacters,
				npc: reloadNpcs,
				locations: reloadLocations,
			};
			setters[type](orderedEntities);

			try {
				await campaignApi.replaceEntities(campaignSlug, type, orderedEntities);
			} catch (error) {
				onReorderError?.(error, type);
				await reloaders[type]();
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
		async ({
			sourceType,
			targetType,
			id,
		}: MoveBetweenCharacterTypesOptions): Promise<void> => {
			if (!id || sourceType === targetType) return;

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
					setCharacters((current) =>
						current.filter((item) => item.id !== id),
					);
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
