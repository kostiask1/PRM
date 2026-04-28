import { useEffect, useState } from "react";

import { confirm, refreshEntitiesAction } from "../../actions/app";
import { api } from "../../api";
import { useAppDispatch } from "../../store/appStore";
import { lang } from "../../services/localization";
import CharacterCard from "../CharacterCard";
import LocationCard from "../LocationCard";

const sanitizeEntityForSave = (entity) =>
	Object.fromEntries(
		Object.entries(entity || {}).filter(([key]) => !key.startsWith("_")),
	);

const normalizeMentionName = (value) =>
	String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();

export default function EntityModalContent({
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
		await api.updateEntity(
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

		const saved = await api.updateEntity(campaignSlug, type, updated.slug, {
			...sanitizeEntityForSave(updated),
			_updateMentionReferences: true,
			_mentionOldName: oldName,
		});
		setEntity(saved);
		dispatch(refreshEntitiesAction());
		return true;
	};

	if (type === "locations") {
		return (
			<LocationCard
				key={entity?.id || entity?.slug || "entity-modal-location-card"}
				location={{ ...entity, collapsed: false }}
				onChange={handleUpdate}
				onNameBlur={handleNameBlur}
				onDelete={async () => {
					await api.deleteEntity(campaignSlug, type, entity.slug);
					dispatch(refreshEntitiesAction());
					onClose();
				}}
				onToggleCollapse={null}
				campaignSlug={campaignSlug}
				viewMode="modal"
			/>
		);
	}

	return (
		<CharacterCard
			key={entity?.id || entity?.slug || "entity-modal-card"}
			character={{ ...entity, collapsed: false }}
			onChange={handleUpdate}
			onNameBlur={handleNameBlur}
			onDelete={async () => {
				await api.deleteEntity(campaignSlug, type, entity.slug);
				dispatch(refreshEntitiesAction());
				onClose();
			}}
			onToggleCollapse={null}
			campaignSlug={campaignSlug}
			type={type}
			viewMode="modal"
		/>
	);
}
