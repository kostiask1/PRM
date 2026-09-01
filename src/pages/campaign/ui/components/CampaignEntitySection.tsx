import type { ReactNode } from "react";
import "../../../../assets/components/CampaignEntitySection.css";
import {
	Button,
	CollapseToggleButton,
	DraggableList,
} from "../../../../shared/ui/index.js";
import { BulkCollapseButton } from "../../../../features/notes/ui/index.js";
import type { CampaignPageEntity } from "../../model/contracts.ts";
import { getCampaignEntityRenderKey } from "../../model/campaignPagePresentation.ts";

interface CampaignEntitySectionProps {
	title: string;
	items: CampaignPageEntity[];
	hasData: boolean;
	isCollapsed: boolean;
	listVariant: "person" | "location";
	historyFocusId: string;
	dropType?: "characters" | "npc";
	actions: ReactNode;
	dragData?: (entity: CampaignPageEntity) => unknown;
	renderItemControl?: (entity: CampaignPageEntity) => ReactNode;
	isItemControlActive?: (entity: CampaignPageEntity) => boolean;
	renderItem: (entity: CampaignPageEntity) => ReactNode;
	onToggle: () => void;
	onBulkCollapse: (
		items: CampaignPageEntity[],
		collapsed: boolean,
	) => void;
	onReorder: (items: CampaignPageEntity[]) => void;
	onReorderDrop: (items: CampaignPageEntity[]) => void;
}

export default function CampaignEntitySection({
	title,
	items,
	hasData,
	isCollapsed,
	listVariant,
	historyFocusId,
	dropType,
	actions,
	dragData,
	renderItemControl,
	isItemControlActive,
	renderItem,
	onToggle,
	onBulkCollapse,
	onReorder,
	onReorderDrop,
}: CampaignEntitySectionProps) {
	return (
		<div
			className="CampaignEntitySection"
			data-character-drop-type={dropType}
			data-history-focus-id={historyFocusId}
		>
			<div className="CampaignEntitySection__row">
				<div className="CampaignEntitySection__titleGroup" onClick={onToggle}>
					{hasData && (
						<CollapseToggleButton
							size={Button.SIZES.MEDIUM}
							collapsed={isCollapsed}
							onClick={onToggle}
						/>
					)}
					<h3>{title}</h3>
				</div>
				{!isCollapsed && (
					<div className="CampaignEntitySection__actions">
						<BulkCollapseButton
							items={items}
							onChange={(collapsed) => onBulkCollapse(items, collapsed)}
						/>
						{actions}
					</div>
				)}
			</div>
			{!isCollapsed && (
				<DraggableList
					items={items}
					className={`CampaignEntitySection__list CampaignEntitySection__list_${listVariant}`}
					onReorder={onReorder}
					onDrop={onReorderDrop}
					dragData={dragData}
					keyExtractor={(entity, index) =>
						getCampaignEntityRenderKey(entity, index)
					}
					renderItemControl={renderItemControl}
					isItemControlActive={isItemControlActive}
					renderItem={renderItem}
				/>
			)}
		</div>
	);
}
