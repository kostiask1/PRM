const VIRTUAL_NOTE_ID_PREFIX = "__virtual_note__:";

function createNoteId() {
	return Date.now();
}

function resolveVirtualNoteId(noteId) {
	const rawId = String(noteId || "").slice(VIRTUAL_NOTE_ID_PREFIX.length);
	const numericId = Number(rawId);
	return Number.isFinite(numericId) ? numericId : createNoteId();
}

export function createEmptyNote() {
	return {
		id: createNoteId(),
		title: "",
		text: "",
		collapsed: false,
	};
}

export function isVirtualNoteId(noteId) {
	return String(noteId || "").startsWith(VIRTUAL_NOTE_ID_PREFIX);
}

function createVirtualNoteId(notes = []) {
	const last = notes[notes.length - 1];
	return `${VIRTUAL_NOTE_ID_PREFIX}${last?.id ?? "empty"}`;
}

export function getNoteRenderKey(note = {}, fallback) {
	return note._renderKey ?? note.id ?? fallback;
}

export function isNoteEmpty(note = {}, simplifiedMode = false) {
	const title = String(note.title || "").trim();
	const text = String(note.text || "").trim();
	if (simplifiedMode) {
		return text.length === 0;
	}
	return title.length === 0 && text.length === 0;
}

export function getNotesForRender(
	notes = [],
	{ simplifiedNotes = false } = {},
) {
	const next = [...(notes || [])];
	const last = next[next.length - 1];

	if (next.length === 0 || !isNoteEmpty(last, simplifiedNotes)) {
		next.push({
			...createEmptyNote(),
			id: createVirtualNoteId(next),
			_isVirtual: true,
		});
	}

	return next;
}

export function upsertNoteById(notes = [], noteId, updates = {}) {
	const next = [...(notes || [])];
	const index = next.findIndex((note) => note.id === noteId);
	const isVirtual = isVirtualNoteId(noteId);
	const resolvedNoteId = isVirtual ? resolveVirtualNoteId(noteId) : noteId;

	if (index === -1) {
		next.push({
			id: resolvedNoteId,
			title: "",
			text: "",
			collapsed: false,
			...(isVirtual ? { _renderKey: noteId } : {}),
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
			const { _isVirtual, _renderKey, ...cleaned } = note || {};
			if (isVirtualNoteId(cleaned.id)) {
				return { ...cleaned, id: resolveVirtualNoteId(cleaned.id) };
			}
			return cleaned;
		})
		.filter((note) => !isNoteEmpty(note, false));
}
