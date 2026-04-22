import { useEffect, useState } from "react";

import { api } from "../../api";
import CharacterCard from "../CharacterCard";

export default function EntityModalContent({
	initialEntity,
	campaignSlug,
	type,
	onClose,
}) {
	const [entity, setEntity] = useState(initialEntity);

	useEffect(() => {
		setEntity(initialEntity);
	}, [initialEntity]);

	const handleUpdate = async (_id, updated) => {
		setEntity(updated);
		await api.updateEntity(campaignSlug, type, updated.slug, updated);
		window.dispatchEvent(new CustomEvent("refresh-entities"));
	};

	return (
		<CharacterCard
			key={entity?.id || entity?.slug || "entity-modal-card"}
			character={{ ...entity, collapsed: false }}
			onChange={handleUpdate}
			onDelete={async () => {
				await api.deleteEntity(campaignSlug, type, entity.slug);
				window.dispatchEvent(new CustomEvent("refresh-entities"));
				onClose();
			}}
			onToggleCollapse={null}
			campaignSlug={campaignSlug}
			type={type}
			viewMode="modal"
		/>
	);
}
