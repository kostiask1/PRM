import { appStore } from "../store/appStore";

export function createEmptyNote() {
	return {
		id: Date.now(),
		title: "",
		text: "",
		collapsed: false,
	};
}

function isSimplifiedNotesEnabled() {
	return Boolean(appStore.getState()?.ui?.simplifiedNotes);
}

export function appendTrailingEmptyNote(notes = []) {
	const next = [...notes];
	const last = next[next.length - 1];
	const isSimplifiedMode = isSimplifiedNotesEnabled();
	if (
		next.length === 0 ||
		(last &&
			(last.text?.trim() !== "" ||
				(!isSimplifiedMode && last.title?.trim() !== "")))
	) {
		next.push(createEmptyNote());
	}
	return next;
}

export function ensureAtLeastOneNote(notes = []) {
	return notes.length > 0 ? notes : [createEmptyNote()];
}
