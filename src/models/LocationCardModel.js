import {
	createEmptyNote,
	upsertNoteById,
} from "../utils/noteUtils.js";

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

export const LOCATION_FIELD_SCHEMA = {
	id: { type: "number|string", required: true },
	slug: { type: "string" },
	name: { type: "string", required: true },
	description: { type: "string" },
	notes: { type: "LocationNote[]" },
	collapsed: { type: "boolean" },
	isNotesCollapsed: { type: "boolean" },
	imageUrl: { type: "string|null" },
};

export default class LocationCardModel {
	/** @param {LocationData} location */
	constructor(location = {}) {
		this.location = location;
	}

	static get schema() {
		return LOCATION_FIELD_SCHEMA;
	}

	static createEmptyNote() {
		return createEmptyNote();
	}

	get data() {
		return this.location;
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
		return Array.isArray(this.location.notes) ? [...this.location.notes] : [];
	}

	get hasImage() {
		return Boolean(this.location.imageUrl);
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
		return this.notes.filter((note) => note.id !== noteId);
	}

	toggleNoteCollapse(noteId) {
		return this.notes.map((note) =>
			note.id === noteId ? { ...note, collapsed: !note.collapsed } : note,
		);
	}
}
