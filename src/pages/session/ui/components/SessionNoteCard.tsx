import { EditableField } from "../../../../features/editor/ui/index.js";
import { createNoteCardComponent } from "../../../../features/notes/ui/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";

const SessionNoteCard = createNoteCardComponent({
	EditableField,
	renderMentionText,
});

export default SessionNoteCard;
