import type { ReactNode } from "react";
import {
	AiContextIgnoreButton,
	BulkCollapseButton,
} from "../../../../features/notes/ui/index.js";
import { DraggableList } from "../../../../shared/ui/index.js";
import TodoSection from "./TodoSection.tsx";

interface SessionEntityListItem {
	collapsed?: boolean;
	id: string | number;
	_aiIgnored?: boolean;
}

interface SessionEntitySectionProps<Item extends SessionEntityListItem> {
	title: ReactNode;
	actions: ReactNode;
	emptyText: ReactNode;
	items: Item[];
	listClassName: string;
	onBulkCollapse: (items: Item[], collapsed: boolean) => void;
	onReorder: (items: Item[]) => void;
	onToggleAiIgnored: (entityId: Item["id"], ignored: boolean) => void;
	renderItem: (item: Item) => ReactNode;
}

export default function SessionEntitySection<Item extends SessionEntityListItem>({
	title,
	actions,
	emptyText,
	items,
	listClassName,
	onBulkCollapse,
	onReorder,
	onToggleAiIgnored,
	renderItem,
}: SessionEntitySectionProps<Item>) {
	return (
		<TodoSection
			title={title}
			action={
				<div className="SessionView__sectionActions">
					<BulkCollapseButton
						items={items}
						onChange={(collapsed) => onBulkCollapse(items, collapsed)}
					/>
					{actions}
				</div>
			}
		>
			{items.length > 0 ? (
				<DraggableList
					items={items}
					className={listClassName}
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
					renderItem={renderItem}
				/>
			) : (
				<div className="muted SessionView__emptySection">{emptyText}</div>
			)}
		</TodoSection>
	);
}
