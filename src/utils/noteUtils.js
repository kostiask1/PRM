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

export function isNoteEmpty(note = {}, simplifiedMode = false) {
	const title = String(note.title || "").trim();
	const text = String(note.text || "").trim();
	if (simplifiedMode) {
		return text.length === 0;
	}
	return title.length === 0 && text.length === 0;
}

export function getNotesForRender(notes = []) {
	const next = [...(notes || [])];
	const last = next[next.length - 1];
	const isSimplifiedMode = isSimplifiedNotesEnabled();

	if (next.length === 0 || !isNoteEmpty(last, isSimplifiedMode)) {
		next.push({
			...createEmptyNote(),
			_isVirtual: true,
		});
	}

	return next;
}

export function upsertNoteById(notes = [], noteId, updates = {}) {
	const next = [...(notes || [])];
	const index = next.findIndex((note) => note.id === noteId);

	if (index === -1) {
		next.push({
			id: noteId,
			title: "",
			text: "",
			collapsed: false,
			...updates,
		});
		return next;
	}

	next[index] = { ...next[index], ...updates };
	return next;
}

export function sanitizeNotesForSave(notes = []) {
	return (notes || [])
		.map((note) => {
			const { _isVirtual, ...cleaned } = note || {};
			return cleaned;
		})
		.filter((note) => !isNoteEmpty(note, false));
}
