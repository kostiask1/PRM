import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
	confirm,
	refreshEntitiesAction,
} from "../../shared/model/index.js";
import { campaignApi } from "../../entities/campaign/api.js";
import {
	CharacterCardView as CharacterCard,
	LocationCardView as LocationCard,
} from "../../entities/campaign/ui.js";
import { ImageAssetField } from "../../features/images/index.js";
import { lang } from "../../shared/config/index.js";
import { useAppDispatch, useAppSelector } from "../../shared/lib/index.js";
import { sanitizeNotesForSave } from "../../utils/noteUtils";
import { EntityLinkResolverContext } from "../../components/common/EntityLinkIdentity";

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
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const [entity, setEntity] = useState(initialEntity);

	useEffect(() => {
		setEntity(initialEntity);
	}, [initialEntity]);

	const handleUpdate = async (_id, updated) => {
		setEntity(updated);
		await campaignApi.updateEntity(
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

		const saved = await campaignApi.updateEntity(
			campaignSlug,
			type,
			updated.slug,
			{
			...sanitizeEntityForSave(updated),
			_updateMentionReferences: true,
			_mentionOldName: oldName,
			},
		);
		setEntity(saved);
		dispatch(refreshEntitiesAction());
		return true;
	};

	const handleDelete = async () => {
		await campaignApi.deleteEntity(campaignSlug, type, entity.slug);
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
				ImageAssetFieldComponent={ImageAssetField}
				simplifiedNotesEnabled={simplifiedNotesEnabled}
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
			ImageAssetFieldComponent={ImageAssetField}
			simplifiedNotesEnabled={simplifiedNotesEnabled}
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
