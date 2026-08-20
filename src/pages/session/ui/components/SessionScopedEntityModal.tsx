import {
	CharacterCard,
	LocationCard,
} from "../../../../widgets/campaign-entity-card/index.js";
import { normalizeSessionEntity } from "../../model/sessionEntityModel.ts";

interface SessionScopedEntityModalProps {
	type: string;
	entity: Record<string, unknown>;
	campaignSlug?: string | null;
	onLocationChange: (
		id: string | number | undefined,
		updatedEntity: Record<string, unknown>,
	) => void;
	onLocationDelete: (id: string | number | undefined) => void;
	onNpcChange: (
		id: string | number | undefined,
		updatedEntity: Record<string, unknown>,
	) => void;
	onNpcDelete: (id: string | number | undefined) => void;
}

export default function SessionScopedEntityModal({
	type,
	entity,
	campaignSlug,
	onLocationChange,
	onLocationDelete,
	onNpcChange,
	onNpcDelete,
}: SessionScopedEntityModalProps) {
	if (type === "locations") {
		const location = normalizeSessionEntity("locations", entity);
		return (
			<LocationCard
				key={location.id}
				location={{ ...location, collapsed: false }}
				onChange={onLocationChange}
				onDelete={onLocationDelete}
				onToggleCollapse={null}
				campaignSlug={campaignSlug}
				enableHistory={false}
				viewMode="modal"
			/>
		);
	}

	const npc = normalizeSessionEntity("npc", entity);
	return (
		<CharacterCard
			key={npc.id}
			character={{ ...npc, collapsed: false }}
			onChange={onNpcChange}
			onDelete={onNpcDelete}
			onToggleCollapse={null}
			campaignSlug={campaignSlug}
			enableHistory={false}
			type="npc"
			viewMode="modal"
		/>
	);
}
