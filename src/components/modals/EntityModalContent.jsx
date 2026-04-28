import { useEffect, useState } from "react";

import { refreshEntitiesAction } from "../../actions/app";
import { api } from "../../api";
import { useAppDispatch } from "../../store/appStore";
import CharacterCard from "../CharacterCard";
import LocationCard from "../LocationCard";

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
		await api.updateEntity(campaignSlug, type, updated.slug, updated);
		dispatch(refreshEntitiesAction());
	};

	if (type === "locations") {
		return (
			<LocationCard
				key={entity?.id || entity?.slug || "entity-modal-location-card"}
				location={{ ...entity, collapsed: false }}
				onChange={handleUpdate}
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
