import { useRef, type ReactNode } from "react";
import "../../../../assets/components/SessionEntitySection.css";
import "../../../../assets/components/CampaignEntitySection.css";
import {
	AiContextIgnoreButton,
} from "../../../../features/notes/ui/index.js";
import { DraggableList, useHashItemSelection } from "../../../../shared/ui/index.js";
import { lang, makeDomId } from "../../../../shared/lib/index.js";
import { matchesHistoryTargetId } from "../../../../entities/history/index.js";
import TodoSection from "./TodoSection.tsx";

interface SessionEntityListItem {
	collapsed?: boolean;
	id: string | number;
	_aiIgnored?: boolean;
	name?: unknown;
	title?: unknown;
	firstName?: unknown;
	lastName?: unknown;
	imageUrl?: unknown;
}

interface SessionEntitySectionProps<Item extends SessionEntityListItem> {
	title: ReactNode;
	actions: ReactNode;
	emptyText: ReactNode;
	items: Item[];
	selectionRequest?: { id: string | number } | null;
	listVariant: "person" | "location";
	historyFocusId: string;
	onReorder: (items: Item[]) => void;
	onToggleAiIgnored: (entityId: Item["id"], ignored: boolean) => void;
	renderItem: (item: Item) => ReactNode;
}

export default function SessionEntitySection<Item extends SessionEntityListItem>({
	title,
	actions,
	emptyText,
	items,
	selectionRequest,
	listVariant,
	historyFocusId,
	onReorder,
	onToggleAiIgnored,
	renderItem,
}: SessionEntitySectionProps<Item>) {
	const detailRef = useRef<HTMLDivElement>(null);
	const kind = listVariant === "location" ? "location" : "npc";
	const { selected, setSelectedKey } = useHashItemSelection(items, (item) => String(item.id), (item, hash) => matchesHistoryTargetId(hash, "session", kind, item.id) || matchesHistoryTargetId(hash, "session", `${kind}-note`, item.id) || hash === `#${makeDomId("session", kind, item.id)}`, undefined, selectionRequest, detailRef);
	return (
		<TodoSection
			title={title}
			historyFocusId={historyFocusId}
			action={
				<div className="SessionEntitySection__actions">
					{actions}
				</div>
			}
		>
			{items.length > 0 ? (
				<div className="CampaignEntitySection__workspace"><DraggableList
					items={items}
					className="CampaignEntitySection__list EntitySelectionList"
					keyboardReorder
					getKeyboardReorderLabel={(item) => {
						const name = listVariant === "location" ? item.name || item.title : [item.firstName, item.lastName].filter(Boolean).join(" ") || item.name;
						return lang.t("Reorder item: {name} (arrow keys)", { name: String(name || lang.t("Untitled")) });
					}}
					onReorder={onReorder}
					keyExtractor={(entity) => entity.id}
					isItemControlActive={(entity) => Boolean(entity._aiIgnored)}
					renderItemControl={(entity) => (
						<AiContextIgnoreButton
							ignored={Boolean(entity._aiIgnored)}
							onToggle={(ignored) =>
								onToggleAiIgnored(entity.id, ignored)
							}
						/>
					)}
					renderItem={(item) => {
						const name = listVariant === "location" ? item.name || item.title : [item.firstName, item.lastName].filter(Boolean).join(" ") || item.name;
						return <button type="button" className="CampaignEntitySection__item" aria-pressed={item === selected} onClick={() => { setSelectedKey(String(item.id)); detailRef.current?.querySelectorAll<HTMLElement>(":scope > [data-entity-index]")[items.indexOf(item)]?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>{typeof item.imageUrl === "string" && item.imageUrl && <img src={item.imageUrl} alt="" />}<span>{String(name || lang.t("Untitled"))}</span></button>;
					}}
				/>
				<div ref={detailRef} className="CampaignEntitySection__detail CampaignEntitySection__detail_stream">{items.map((item, index) => <div key={String(item.id)} data-entity-index={index}>{renderItem(item)}</div>)}</div></div>
			) : (
				<div className="muted SessionEntitySection__empty">{emptyText}</div>
			)}
		</TodoSection>
	);
}
