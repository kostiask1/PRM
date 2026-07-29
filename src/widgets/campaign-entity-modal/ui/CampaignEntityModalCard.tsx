import type {
	CharacterData,
	LocationData,
} from "../../../entities/campaign/index.js";
import {
	getCampaignEntityModalCardPlan,
	type CampaignModalEntity,
} from "../model.js";
import type {
	CampaignEntityModalCharacterCardComponent,
	CampaignEntityModalLocationCardComponent,
} from "./campaignEntityModalSlots.ts";

export interface CampaignEntityModalCardProps {
	CharacterCard: CampaignEntityModalCharacterCardComponent;
	LocationCard: CampaignEntityModalLocationCardComponent;
	entity: CampaignModalEntity;
	campaignSlug: string;
	type: string;
	onChange: (id: string | number | undefined, entity: CampaignModalEntity) => void | Promise<void>;
	onNameBlur: (
		id: string | number | undefined,
		entity: CampaignModalEntity,
		oldName: string,
		newName: string,
	) => boolean | Promise<boolean>;
	onDelete: () => void | Promise<void>;
}

export default function CampaignEntityModalCard({
	CharacterCard,
	LocationCard,
	entity,
	campaignSlug,
	type,
	onChange,
	onNameBlur,
	onDelete,
}: CampaignEntityModalCardProps) {
	const plan = getCampaignEntityModalCardPlan(type, entity);
	if (plan.kind === "location") {
		return (
			<LocationCard
				key={plan.key}
				location={{ ...entity, collapsed: false } as LocationData}
				onChange={(id, updated) => onChange(id, updated as CampaignModalEntity)}
				onNameBlur={(id, updated, oldName, newName) =>
					onNameBlur(id, updated as CampaignModalEntity, oldName, newName)
				}
				onDelete={() => onDelete()}
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
			key={plan.key}
			character={{ ...entity, collapsed: false } as CharacterData}
			onChange={(id, updated) => onChange(id, updated as CampaignModalEntity)}
			onNameBlur={(id, updated, oldName, newName) =>
				onNameBlur(id, updated as CampaignModalEntity, oldName, newName)
			}
			onDelete={() => onDelete()}
			onToggleCollapse={null}
			campaignSlug={campaignSlug}
			type={type}
			viewMode="modal"
			showDeleteButton={false}
			showHeader={false}
		/>
	);
}
