import type { ReactNode } from "react";
import "../../../../assets/components/SessionNotesSection.css";
import "../../../../assets/components/CampaignEntitySection.css";
import {
	getAiIgnoredNoteListProps,
} from "../../../../features/notes/ui/index.js";
import { getNoteListLabel, lang, makeDomId, type SharedNote } from "../../../../shared/lib/index.js";
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
	const { selected, setSelectedKey } = useHashItemSelection(renderableNotes, (note) => String(note.id), (note, hash) => matchesHistoryTargetId(hash, "session", "note", note.id) || hash === `#${makeDomId("session", "note", note.id)}`, (note, key) => note._renderKey != null && String(note._renderKey) === key);
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
					renderItem={(note) => <button type="button" className="CampaignEntitySection__item" aria-pressed={note === selected} onClick={() => setSelectedKey(String(note.id))}><span>{getNoteListLabel(note) || lang.t("New note")}</span></button>}
				/>
				<div className="CampaignEntitySection__detail">{selected && renderItem(selected, false, renderableNotes.indexOf(selected))}</div>
			</div>
		</TodoSection>
	);
}
