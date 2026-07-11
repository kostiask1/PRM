const VIRTUAL_NOTE_ID_PREFIX = "__virtual_note__:";
let lastNoteId = 0;

function createNoteId(notes = []) {
	const existingIds = new Set((notes || []).map((note) => String(note?.id)));
	let nextId = Math.max(Date.now(), lastNoteId + 1);
	while (existingIds.has(String(nextId))) nextId += 1;
	lastNoteId = nextId;
	return nextId;
}

function resolveVirtualNoteId(notes = []) {
	return createNoteId(notes);
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
			id: createVirtualNoteId(next),
			title: "",
			text: "",
			collapsed: false,
			_isVirtual: true,
		});
	}

	return next;
}

export function upsertNoteById(notes = [], noteId, updates = {}) {
	const next = [...(notes || [])];
	const index = next.findIndex((note) => note.id === noteId);
	const isVirtual = isVirtualNoteId(noteId);
	const resolvedNoteId = isVirtual ? resolveVirtualNoteId(next) : noteId;

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
	const sourceNotes = notes || [];
	return sourceNotes
		.map((note, index) => {
			const { _isVirtual, _renderKey, ...cleaned } = note || {};
			if (isVirtualNoteId(cleaned.id)) {
				return {
					...cleaned,
					id: resolveVirtualNoteId(sourceNotes.slice(0, index)),
				};
			}
			return cleaned;
		})
		.filter((note) => !isNoteEmpty(note, false));
}
