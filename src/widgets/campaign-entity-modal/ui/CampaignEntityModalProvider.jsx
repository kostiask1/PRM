import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import { confirm, refreshEntitiesAction } from "../../../shared/model/index.js";
import {
	deleteCampaignEntity,
	updateCampaignEntity,
} from "../../../features/campaign-entity/index.js";
import { lang } from "../../../shared/lib/index.js";
import { useAppDispatch } from "../../../shared/model/index.js";
import { sanitizeNotesForSave } from "../../../shared/lib/index.js";
import {
	CharacterCard,
	LocationCard,
} from "../../campaign-entity-card/index.js";
import { EntityLinkResolverContext } from "../../../features/entity-link/index.js";

const sanitizeEntityForSave = (entity) => {
	const sanitized = Object.fromEntries(
		Object.entries(entity || {}).filter(([key]) => !key.startsWith("_")),
	);
	if (Array.isArray(sanitized.notes)) {
		sanitized.notes = sanitizeNotesForSave(sanitized.notes);
	}
	return sanitized;
};

const normalizeMentionName = (value) =>
	String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();

function CampaignEntityModalContent({
	initialEntity,
	campaignSlug,
	type,
	onClose,
}) {
	const dispatch = useAppDispatch();
	const [entity, setEntity] = useState(initialEntity);

	useEffect(() => {
		setEntity(initialEntity);
	}, [initialEntity]);

	const handleUpdate = async (_id, updated) => {
		setEntity(updated);
		await updateCampaignEntity(
			campaignSlug,
			type,
			updated.slug,
			sanitizeEntityForSave(updated),
		);
		dispatch(refreshEntitiesAction());
	};

	const handleNameBlur = async (_id, updated, oldName, newName) => {
		if (
			!normalizeMentionName(oldName) ||
			!String(newName || "").trim() ||
			normalizeMentionName(oldName) === normalizeMentionName(newName)
		) {
			return true;
		}

		const shouldUpdateMentions = await dispatch(
			confirm({
				title: lang.t("Update links?"),
				message: lang.t(
					'Update links in the project from "{oldName}" to "{newName}"?',
					{ oldName, newName },
				),
			}),
		);
		if (!shouldUpdateMentions) return false;

		const saved = await updateCampaignEntity(campaignSlug, type, updated.slug, {
			...sanitizeEntityForSave(updated),
			_updateMentionReferences: true,
			_mentionOldName: oldName,
		});
		setEntity(saved);
		dispatch(refreshEntitiesAction());
		return true;
	};

	const handleDelete = async () => {
		await deleteCampaignEntity(campaignSlug, type, entity.slug);
		dispatch(refreshEntitiesAction());
		onClose?.();
	};

	if (!campaignSlug || !entity) return null;

	if (type === "locations") {
		return (
			<LocationCard
				key={entity?.id || entity?.slug || "entity-modal-location-card"}
				location={{ ...entity, collapsed: false }}
				onChange={handleUpdate}
				onNameBlur={handleNameBlur}
				onDelete={handleDelete}
				onToggleCollapse={null}
				campaignSlug={campaignSlug}
				viewMode="modal"
				showDeleteButton={false}
				showHeader={false}
			/>
		);
	}

	return (
		<CharacterCard
			key={entity?.id || entity?.slug || "entity-modal-card"}
			character={{ ...entity, collapsed: false }}
			onChange={handleUpdate}
			onNameBlur={handleNameBlur}
			onDelete={handleDelete}
			onToggleCollapse={null}
			campaignSlug={campaignSlug}
			type={type}
			viewMode="modal"
			showDeleteButton={false}
			showHeader={false}
		/>
	);
}

export default function CampaignEntityModalProvider({
	campaignSlug,
	children,
}) {
	const parentEntityLinks = useContext(EntityLinkResolverContext);

	const renderModalContent = useCallback(
		(modalState, onClose) => {
			const parentContent =
				parentEntityLinks?.renderModalContent?.(modalState, onClose);
			if (parentContent) return parentContent;
			if (!campaignSlug || modalState?.scope) return null;

			return (
				<CampaignEntityModalContent
					initialEntity={modalState.entity}
					campaignSlug={campaignSlug}
					type={modalState.type}
					onClose={onClose}
				/>
			);
		},
		[campaignSlug, parentEntityLinks],
	);

	const value = useMemo(
		() => ({
			...(parentEntityLinks || {}),
			renderModalContent,
		}),
		[parentEntityLinks, renderModalContent],
	);

	return (
		<EntityLinkResolverContext.Provider value={value}>
			{children}
		</EntityLinkResolverContext.Provider>
	);
}
