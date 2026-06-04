import { createEmptyNote, upsertNoteById } from "../utils/noteUtils.js";

/**
 * @typedef {Object} LocationNote
 * @property {number|string} id
 * @property {string} title
 * @property {string} text
 * @property {boolean} collapsed
 */

/**
 * Location/faction schema.
 * @typedef {Object} LocationData
 * @property {number|string} id
 * @property {string} [slug]
 * @property {string} name
 * @property {string} description
 * @property {LocationNote[]} notes
 * @property {boolean} collapsed
 * @property {boolean} [isNotesCollapsed]
 * @property {string|null} [imageUrl]
 */

export default class LocationCardModel {
	/** @param {LocationData} location */
	constructor(location = {}) {
		this.location = location;
	}

	get displayName() {
		return this.location.name || this.location.title || "";
	}

	get briefMeta() {
		const text = String(this.location.description || "")
			.replace(/\s+/g, " ")
			.trim();
		if (text.length <= 120) return text;
		return `${text.slice(0, 117).trim()}...`;
	}

	get notes() {
		const notes = Array.isArray(this.location.notes)
			? [...this.location.notes]
			: [];
		return notes.length > 0 ? notes : [createEmptyNote()];
	}

	withField(field, value) {
		return {
			...this.location,
			[field]: value,
		};
	}

	withUpdatedNote(noteId, updates = {}) {
		return upsertNoteById(this.notes, noteId, updates);
	}

	withDeletedNote(noteId) {
		const nextNotes = this.notes.filter((note) => note.id !== noteId);
		return nextNotes.length > 0 ? nextNotes : [createEmptyNote()];
	}

	toggleNoteCollapse(noteId) {
		return this.notes.map((note) =>
			note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
		);
	}
}
