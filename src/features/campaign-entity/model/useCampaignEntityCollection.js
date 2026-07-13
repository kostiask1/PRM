import { useCallback } from "react";
import {
	deleteCampaignEntity,
	updateCampaignEntity,
} from "./createEntity.js";

export const replaceEntityById = (entities, id, replacement) =>
	entities.map((entity) => (entity.id === id ? replacement : entity));

export const removeEntityById = (entities, id) =>
	entities.filter((entity) => entity.id !== id);

export function useCampaignEntityCollection({
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
}) {
	const recover = useCallback(
		async (operation, error) => {
			onError(`Failed to ${operation} ${type} entity`, error);
			await reload?.();
		},
		[onError, reload, type],
	);

	const toggleCollapse = useCallback(
		(id) => {
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
		(id, updated, options = {}) => {
			if (options.trackUndo) pushUndo?.();
			setEntities((current) => replaceEntityById(current, id, updated));
			if (!updated._isPending) scheduleSave(type, updated);
		},
		[pushUndo, scheduleSave, setEntities, type],
	);

	const rename = useCallback(
		async (id, updated, oldName, newName) => {
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
		async (id) => {
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
