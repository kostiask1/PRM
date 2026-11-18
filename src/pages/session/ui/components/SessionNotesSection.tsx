import { useRef, type ReactNode } from "react";
import "../../../../assets/components/SessionNotesSection.css";
import "../../../../assets/components/CampaignEntitySection.css";
import {
	getAiIgnoredNoteListProps,
} from "../../../../features/notes/ui/index.js";
import { getNoteListLabel, getNoteListPreview, lang, makeDomId, type SharedNote } from "../../../../shared/lib/index.js";
import { EntityLinkedListItem } from "../../../../features/entity-link/index.js";
import { DraggableList, useHashItemSelection } from "../../../../shared/ui/index.js";
import { matchesHistoryTargetId } from "../../../../entities/history/index.js";
import TodoSection from "./TodoSection.tsx";

type SessionNoteListItem = SharedNote & {
	_aiIgnored?: boolean;
	_isVirtual?: boolean;
	_renderKey?: string | number;
};

interface SessionNotesSectionProps {
	renderableNotes: readonly SessionNoteListItem[];
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
	renderableNotes,
	onToggleAiIgnored,
	onReorder,
	renderItem,
}: SessionNotesSectionProps) {
	const detailRef = useRef<HTMLDivElement>(null);
	const { selected, setSelectedKey } = useHashItemSelection(renderableNotes, (note) => String(note.id), (note, hash) => matchesHistoryTargetId(hash, "session", "note", note.id) || hash === `#${makeDomId("session", "note", note.id)}`, (note, key) => note._renderKey != null && String(note._renderKey) === key, undefined, detailRef);
	return (
		<TodoSection
			title={lang.t("Notes")}
		>
			<div className="CampaignEntitySection__workspace">
				<DraggableList
					items={renderableNotes}
					className="CampaignEntitySection__list NoteSelectionList"
					keyboardReorder
					getKeyboardReorderLabel={(note) => lang.t("Reorder note: {name} (arrow keys)", { name: getNoteListLabel(note) || lang.t("New note") })}
					onReorder={onReorder}
					{...getAiIgnoredNoteListProps(onToggleAiIgnored, {
						isolateDragEvents: false,
					})}
					renderItem={(note) => { const preview = getNoteListPreview(note); const label = getNoteListLabel(note) || lang.t("New note"); return <EntityLinkedListItem text={preview.text || label} label={label} maxLength={preview.maxLength} selected={note === selected} onSelect={() => { setSelectedKey(String(note.id)); detailRef.current?.querySelectorAll<HTMLElement>(":scope > [data-note-index]")[renderableNotes.indexOf(note)]?.scrollIntoView({ block: "start", behavior: "smooth" }); }} />; }}
				/>
				<div ref={detailRef} className="CampaignEntitySection__detail CampaignEntitySection__detail_stream">{renderableNotes.map((note, index) => <div key={String(note.id)} data-note-index={index}>{renderItem(note, false, index)}</div>)}</div>
			</div>
		</TodoSection>
	);
}
