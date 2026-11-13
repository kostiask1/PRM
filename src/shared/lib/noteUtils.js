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

export function getNoteListPreview(note = {}) {
	const title = String(note.title || "").trim();
	if (title) return { text: title, maxLength: undefined };
	const text = String(note.text || "")
		.replace(/^\s{0,3}(?:`{3,}|~{3,})[^\n]*$/gm, "")
		.replace(/(?<!\\)!?\[([^\]]*)\]\([^\n)]*\)/g, "$1")
		.replace(/^(\s{0,3}#{1,6}\s+.*?)\s+#+\s*$/gm, "$1")
		.replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, "")
		.replace(/^\s{0,3}[-*_]{3,}\s*$/gm, "")
		.replace(/(?<!\\)(`+)([^`]+)(?<!\\)\1/g, "$2")
		.replace(/(?<!\\)(\*\*|__|~~)(?=\S)([\s\S]*?\S)(?<!\\)\1/g, "$2")
		.replace(/(^|[^\p{L}\p{N}_])(?<!\\)([*_])(?=\S)([^\n]*?\S)(?<!\\)\2(?=$|[^\p{L}\p{N}_])/gu, "$1$3")
		.replace(/\\([\\`*_{}[\]()#+\-.!>~])/g, "$1")
		.replace(/\s+/g, " ")
		.trim();
	return { text, maxLength: 30 };
}

export function getNoteListLabel(note = {}) {
	const { text, maxLength } = getNoteListPreview(note);
	const visible = text.replace(/\[([^\]]+)\]/g, (_, name) => name.trim());
	const characters = Array.from(visible);
	return maxLength !== undefined && characters.length > maxLength
		? `${characters.slice(0, maxLength).join("").trimEnd()}...`
		: visible;
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
