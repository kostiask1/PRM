import { upsertNoteById } from "../../../utils/noteUtils.js";

function getCardNotes(entity = {}) {
	return Array.isArray(entity.notes) ? [...entity.notes] : [];
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
	return notes.filter((note) => note.id !== noteId);
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
