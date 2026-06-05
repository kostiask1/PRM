import { createEmptyNote, upsertNoteById } from "../utils/noteUtils.js";

function getCardNotes(entity = {}) {
	const notes = Array.isArray(entity.notes) ? [...entity.notes] : [];
	return notes.length > 0 ? notes : [createEmptyNote()];
}

function withCardField(entity = {}, field, value) {
	return {
		...entity,
		[field]: value,
	};
}

function withUpdatedCardNote(notes, noteId, updates = {}) {
	return upsertNoteById(notes, noteId, updates);
}

function withDeletedCardNote(notes, noteId) {
	const nextNotes = notes.filter((note) => note.id !== noteId);
	return nextNotes.length > 0 ? nextNotes : [createEmptyNote()];
}

function toggleCardNoteCollapse(notes, noteId) {
	return notes.map((note) =>
		note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
	);
}

export class CardNoteModel {
	get entity() {
		return {};
	}

	get notes() {
		return getCardNotes(this.entity);
	}

	withField(field, value) {
		return withCardField(this.entity, field, value);
	}

	withUpdatedNote(noteId, updates = {}) {
		return withUpdatedCardNote(this.notes, noteId, updates);
	}

	withDeletedNote(noteId) {
		return withDeletedCardNote(this.notes, noteId);
	}

	toggleNoteCollapse(noteId) {
		return toggleCardNoteCollapse(this.notes, noteId);
	}
}
