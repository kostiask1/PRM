import type { ReactNode } from "react";
import "../../../../assets/components/SessionNotesSection.css";
import {
	BulkCollapseButton,
	getAiIgnoredNoteListProps,
} from "../../../../features/notes/ui/index.js";
import { lang, type SharedNote } from "../../../../shared/lib/index.js";
import { DraggableList } from "../../../../shared/ui/index.js";
import TodoSection from "./TodoSection.tsx";

type SessionNoteListItem = SharedNote & {
	_aiIgnored?: boolean;
	_isVirtual?: boolean;
	_renderKey?: string | number;
};

interface SessionNotesSectionProps {
	notes: readonly SharedNote[];
	renderableNotes: readonly SessionNoteListItem[];
	hasData: boolean;
	isCollapsed: boolean;
	onToggle: () => void;
	onBulkCollapse: (collapsed: boolean) => void;
	onToggleAiIgnored: (
		noteId: SessionNoteListItem["id"],
		ignored: boolean,
	) => void;
	onReorder: (notes: SessionNoteListItem[]) => void;
	renderItem: (
		note: SessionNoteListItem,
		isDragging: boolean,
		index: number,
	) => ReactNode;
}

export default function SessionNotesSection({
	notes,
	renderableNotes,
	hasData,
	isCollapsed,
	onToggle,
	onBulkCollapse,
	onToggleAiIgnored,
	onReorder,
	renderItem,
}: SessionNotesSectionProps) {
	return (
		<TodoSection
			title={lang.t("Notes")}
			collapsed={isCollapsed}
			onToggle={hasData ? onToggle : undefined}
			action={
				!isCollapsed && (
					<BulkCollapseButton items={notes} onChange={onBulkCollapse} />
				)
			}
		>
			{!isCollapsed && (
				<DraggableList
					items={renderableNotes}
					className="SessionNotesSection__list"
					onReorder={onReorder}
					{...getAiIgnoredNoteListProps(onToggleAiIgnored, {
						isolateDragEvents: false,
					})}
					renderItem={renderItem}
				/>
			)}
		</TodoSection>
	);
}
