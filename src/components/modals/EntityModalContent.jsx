import { useState } from "react";

import { api } from "../../api";
import CharacterCard from "../CharacterCard";

export default function EntityModalContent({
	initialEntity,
	campaignSlug,
	type,
	onClose,
}) {
	const [entity, setEntity] = useState(initialEntity);

	const handleUpdate = async (_id, updated) => {
		setEntity(updated);
		await api.updateEntity(campaignSlug, type, updated.slug, updated);
		window.dispatchEvent(new CustomEvent("refresh-entities"));
	};

	return (
		<CharacterCard
			character={{ ...entity, collapsed: false }}
			onChange={handleUpdate}
			onDelete={async () => {
				await api.deleteEntity(campaignSlug, type, entity.slug);
				window.dispatchEvent(new CustomEvent("refresh-entities"));
				onClose();
			}}
			onToggleCollapse={() => {}}
			campaignSlug={campaignSlug}
			type={type}
		/>
	);
}
