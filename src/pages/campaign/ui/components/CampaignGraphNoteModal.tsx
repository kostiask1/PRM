import { useEffect, useRef, useState } from "react";

import {
	EditableField,
	type EditableFieldChangeEvent,
} from "../../../../features/editor/ui/index.js";
import { lang, type SharedNote } from "../../../../shared/lib/index.js";

interface GraphNoteDraft extends Record<string, unknown> {
	title: string;
	text: string;
}

interface CampaignGraphNoteModalProps {
	note: SharedNote;
	simplifiedNotes: boolean;
	campaignSlug: string;
	onSave: (updates: GraphNoteDraft) => void | Promise<void>;
}

function toGraphNoteDraft(note: SharedNote): GraphNoteDraft {
	return {
		title: typeof note.title === "string" ? note.title : "",
		text: typeof note.text === "string" ? note.text : "",
	};
}

export function CampaignGraphNoteModal({
	note,
	simplifiedNotes,
	campaignSlug,
	onSave,
}: CampaignGraphNoteModalProps) {
	const [draft, setDraft] = useState<GraphNoteDraft>(() => toGraphNoteDraft(note));
	const didMountRef = useRef(false);

	useEffect(() => {
		setDraft(toGraphNoteDraft(note));
	}, [note]);

	useEffect(() => {
		if (!didMountRef.current) {
			didMountRef.current = true;
			return undefined;
		}

		const timer = setTimeout(() => {
			void onSave(draft);
		}, 450);

		return () => clearTimeout(timer);
	}, [draft, onSave]);

	const updateDraft = (updates: Partial<GraphNoteDraft>) => {
		setDraft((previous) => ({ ...previous, ...updates }));
	};

	return (
		<div className="CampaignNotesGraph__noteModal">
			{!simplifiedNotes && (
				<EditableField
					value={draft.title || ""}
					enableHistory={false}
					onChange={(event: EditableFieldChangeEvent) =>
						updateDraft({ title: String(event.target.value) })
					}
					placeholder={lang.t("New note")}
					className="CampaignNotesGraph__noteTitle"
				/>
			)}
			<EditableField
				type="textarea"
				value={draft.text || ""}
				enableHistory={false}
				onChange={(event: EditableFieldChangeEvent) =>
					updateDraft({ text: String(event.target.value) })
				}
				placeholder={lang.t("Note text...")}
				campaignSlug={campaignSlug}
				className="CampaignNotesGraph__noteText"
			/>
		</div>
	);
}
