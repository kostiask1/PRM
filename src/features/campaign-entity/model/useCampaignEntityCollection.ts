import { useCallback } from "react";
import {
	deleteCampaignEntity,
	updateCampaignEntity,
} from "./createEntity.ts";
import type {
	CampaignEntityErrorHandler,
	CampaignEntityNormalizer,
	CampaignEntitySanitizer,
	CampaignEntitySetter,
	CampaignFeatureEntity,
	CampaignFeatureEntityId,
	CampaignFeatureEntityType,
} from "./contracts.ts";

export const replaceEntityById = <T extends CampaignFeatureEntity>(
	entities: T[],
	id: CampaignFeatureEntityId,
	replacement: T,
): T[] => entities.map((entity) => (entity.id === id ? replacement : entity));

export const removeEntityById = <T extends CampaignFeatureEntity>(
	entities: T[],
	id: CampaignFeatureEntityId,
): T[] => entities.filter((entity) => entity.id !== id);

interface EntityChangeOptions {
	trackUndo?: boolean;
}

interface CampaignEntityCollectionOptions<T extends CampaignFeatureEntity> {
	campaignSlug: string;
	type: CampaignFeatureEntityType;
	entities: T[];
	setEntities: CampaignEntitySetter<T>;
	getDisplayName: (entity: T) => string;
	sanitizeEntity: CampaignEntitySanitizer<T>;
	normalizeEntity: CampaignEntityNormalizer<T>;
	scheduleSave: (type: CampaignFeatureEntityType, entity: T) => void;
	clearSave: (
		type: CampaignFeatureEntityType,
		id: CampaignFeatureEntityId,
	) => void;
	confirmMentionUpdate: (oldName: string, newName: string) => Promise<boolean>;
	applyMentionRename: (oldName: string, newName: string) => void;
	reload?: () => void | Promise<void>;
	pushUndo?: () => void;
	onError?: CampaignEntityErrorHandler;
}

export interface CampaignEntityCollection<T extends CampaignFeatureEntity> {
	change: (
		id: CampaignFeatureEntityId,
		updated: T,
		options?: EntityChangeOptions,
	) => void;
	remove: (id: CampaignFeatureEntityId) => Promise<boolean>;
	rename: (
		id: CampaignFeatureEntityId,
		updated: T,
		oldName: string,
		newName: string,
	) => Promise<boolean>;
	toggleCollapse: (id: CampaignFeatureEntityId) => void;
}

export function useCampaignEntityCollection<T extends CampaignFeatureEntity>({
	campaignSlug,
	type,
	entities,
	setEntities,
	getDisplayName,
	sanitizeEntity,
	normalizeEntity,
	scheduleSave,
	clearSave,
	confirmMentionUpdate,
	applyMentionRename,
	reload,
	pushUndo,
	onError = console.error,
}: CampaignEntityCollectionOptions<T>): CampaignEntityCollection<T> {
	const recover = useCallback(
		async (operation: string, error: unknown) => {
			onError(`Failed to ${operation} ${type} entity`, error);
			await reload?.();
		},
		[onError, reload, type],
	);

	const toggleCollapse = useCallback(
		(id: CampaignFeatureEntityId) => {
			const next = entities.map((entity) =>
				entity.id === id
					? { ...entity, collapsed: !entity.collapsed }
					: entity,
			);
			setEntities(next);
			const updated = next.find((entity) => entity.id === id);
			if (updated) scheduleSave(type, updated);
		},
		[entities, scheduleSave, setEntities, type],
	);

	const change = useCallback(
		(id: CampaignFeatureEntityId, updated: T, options: EntityChangeOptions = {}) => {
			if (options.trackUndo) pushUndo?.();
			setEntities((current) => replaceEntityById(current, id, updated));
			if (!updated._isPending) scheduleSave(type, updated);
		},
		[pushUndo, scheduleSave, setEntities, type],
	);

	const rename = useCallback(
		async (
			id: CampaignFeatureEntityId,
			updated: T,
			oldName: string,
			newName: string,
		): Promise<boolean> => {
			const entity = entities.find((item) => item.id === id) || updated;
			if (!entity?.slug || entity._isPending) return true;
			if (!(await confirmMentionUpdate(oldName, newName))) return false;
			clearSave(type, id);
			try {
				const saved = normalizeEntity(
					await updateCampaignEntity(campaignSlug, type, entity.slug, {
						...sanitizeEntity(entity),
						_updateMentionReferences: true,
						_mentionOldName: oldName,
					}),
				);
				setEntities((current) => replaceEntityById(current, id, saved));
				applyMentionRename(oldName, getDisplayName(saved));
				return true;
			} catch (error) {
				await recover("rename", error);
				return false;
			}
		},
		[
			applyMentionRename,
			campaignSlug,
			clearSave,
			confirmMentionUpdate,
			entities,
			getDisplayName,
			normalizeEntity,
			recover,
			sanitizeEntity,
			setEntities,
			type,
		],
	);

	const remove = useCallback(
		async (id: CampaignFeatureEntityId): Promise<boolean> => {
			const entity = entities.find((item) => item.id === id);
			if (!entity?.slug) return false;
			clearSave(type, id);
			try {
				await deleteCampaignEntity(campaignSlug, type, entity.slug);
				setEntities((current) => removeEntityById(current, id));
				return true;
			} catch (error) {
				await recover("delete", error);
				return false;
			}
		},
		[campaignSlug, clearSave, entities, recover, setEntities, type],
	);

	return { change, remove, rename, toggleCollapse };
}
