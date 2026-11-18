import { useRef, type ReactNode } from "react";
import "../../../../assets/components/CampaignEntitySection.css";
import {
	DraggableList,
	useHashItemSelection,
} from "../../../../shared/ui/index.js";
import { lang, makeDomId } from "../../../../shared/lib/index.js";
import { matchesHistoryTargetId } from "../../../../entities/history/index.js";
import type { CampaignPageEntity } from "../../model/contracts.ts";
import { getCampaignEntityRenderKey } from "../../model/campaignPagePresentation.ts";

interface CampaignEntitySectionProps {
	title?: string;
	items: CampaignPageEntity[];
	selectionRequest?: { id: string | number } | null;
	listVariant: "person" | "location";
	historyFocusId: string;
	dropType?: "characters" | "npc";
	actions?: ReactNode;
	dragData?: (entity: CampaignPageEntity) => unknown;
	renderItemControl?: (entity: CampaignPageEntity) => ReactNode;
	isItemControlActive?: (entity: CampaignPageEntity) => boolean;
	renderItem: (entity: CampaignPageEntity) => ReactNode;
	onReorder: (items: CampaignPageEntity[]) => void;
	onReorderDrop: (items: CampaignPageEntity[]) => void;
}

export default function CampaignEntitySection({
	items,
	selectionRequest,
	listVariant,
	historyFocusId,
	dropType,
	dragData,
	renderItemControl,
	isItemControlActive,
	renderItem,
	onReorder,
	onReorderDrop,
}: CampaignEntitySectionProps) {
	const detailRef = useRef<HTMLDivElement>(null);
	const kind = dropType === "characters" ? "character" : dropType === "npc" ? "npc" : "location";
	const { selected, setSelectedKey } = useHashItemSelection(items, (entity, index) => String(getCampaignEntityRenderKey(entity, index)), (entity, hash) => matchesHistoryTargetId(hash, "campaign", kind, entity.id) || matchesHistoryTargetId(hash, "campaign", `${kind}-note`, entity.id) || hash === `#${makeDomId("campaign", kind, entity.id)}`, undefined, selectionRequest, detailRef);
	return (
		<div
			className="CampaignEntitySection"
			data-character-drop-type={dropType}
			data-history-focus-id={historyFocusId}
		>
			<div className="CampaignEntitySection__workspace">
				<DraggableList
					items={items}
					className={`CampaignEntitySection__list CampaignEntitySection__list_${listVariant} EntitySelectionList`}
					keyboardReorder
					getKeyboardReorderLabel={(entity) => {
						const name = listVariant === "location" ? entity.name || entity.title : [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.name;
						return lang.t("Reorder item: {name} (arrow keys)", { name: String(name || lang.t("Untitled")) });
					}}
					onReorder={onReorder}
					onDrop={onReorderDrop}
					dragData={dragData}
					keyExtractor={(entity, index) =>
						getCampaignEntityRenderKey(entity, index)
					}
					renderItemControl={renderItemControl}
					isItemControlActive={isItemControlActive}
					renderItem={(entity, _dragging, index) => {
						const name = listVariant === "location" ? entity.name || entity.title : [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.name;
						return <button type="button" className="CampaignEntitySection__item" aria-pressed={entity === selected} onClick={() => { setSelectedKey(String(getCampaignEntityRenderKey(entity, index))); detailRef.current?.querySelectorAll<HTMLElement>(":scope > [data-detail-key]")[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>
							{typeof entity.imageUrl === "string" && entity.imageUrl && <img src={entity.imageUrl} alt="" />}
							<span>{String(name || lang.t("Untitled"))}</span>
						</button>;
					}}
				/>
				<div className="CampaignEntitySection__detail CampaignEntitySection__detail_stream" ref={detailRef} onScroll={(event) => {
					const container = event.currentTarget;
					const top = container.getBoundingClientRect().top;
					const cards = Array.from(container.querySelectorAll<HTMLElement>(":scope > [data-detail-key]"));
					const active = cards.reduce<HTMLElement | null>((current, card) => card.getBoundingClientRect().top <= top + 24 ? card : current, cards[0] || null);
					if (active?.dataset.detailKey) setSelectedKey(active.dataset.detailKey);
				}}>{items.length ? items.map((item, index) => <div key={getCampaignEntityRenderKey(item, index)} data-detail-key={String(getCampaignEntityRenderKey(item, index))}>{renderItem(item)}</div>) : <p className="muted">{lang.t("No items yet.")}</p>}</div>
			</div>
		</div>
	);
}
