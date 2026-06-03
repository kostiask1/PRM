import { createEmptyNote, upsertNoteById } from "../utils/noteUtils.js";

/**
 * @typedef {Object} CharacterNote
 * @property {number|string} id
 * @property {string} title
 * @property {string} text
 * @property {boolean} collapsed
 */

/**
 * Character/NPC schema (based on create/update flow in withCampaignView/withSessionView).
 * @typedef {Object} CharacterData
 * @property {number|string} id
 * @property {string} [slug]
 * @property {string} [name]
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} race
 * @property {string} class
 * @property {number|string} level
 * @property {string} motivation
 * @property {string} description
 * @property {string} trait
 * @property {CharacterNote[]} notes
 * @property {boolean} collapsed
 * @property {boolean} [isNotesCollapsed]
 * @property {string|null} [imageUrl]
 * @property {boolean} [_isNew]
 */

export const CHARACTER_FIELD_SCHEMA = {
	id: {
		type: "number|string",
		required: true,
		values: "Date.now() or backend id",
	},
	slug: { type: "string", values: "Backend entity slug" },
	firstName: { type: "string", values: "First name" },
	lastName: { type: "string", values: "Last name" },
	race: { type: "string", values: "D&D race" },
	class: { type: "string", values: "D&D class" },
	level: { type: "number|string", values: "1..20" },
	motivation: { type: "string", values: "Character motivation" },
	description: { type: "string", values: "Character description" },
	trait: { type: "string", values: "Trait or habit" },
	notes: {
		type: "CharacterNote[]",
		values: "Notes list, always with at least one item",
	},
	collapsed: { type: "boolean", values: "Card collapsed state" },
	isNotesCollapsed: { type: "boolean", values: "Notes block collapsed state" },
	imageUrl: { type: "string|null", values: "Portrait URL" },
};

export default class CharacterCardModel {
	/** @param {CharacterData} character */
	constructor(character = {}) {
		this.character = character;
	}

	static get schema() {
		return CHARACTER_FIELD_SCHEMA;
	}

	static createEmptyNote() {
		return createEmptyNote();
	}

	get data() {
		return this.character;
	}

	get displayName() {
		return this.character.firstName || this.character.name || "New character";
	}

	get fullName() {
		return `${this.character.firstName || ""} ${this.character.lastName || ""}`.trim();
	}

	get level() {
		return this.character.level === "" ? "" : Number(this.character.level || 1);
	}

	get briefMeta() {
		const race = this.character.race || "";
		const className = this.character.class || "";
		const levelPart = this.character.level
			? `• Lvl. ${this.character.level}`
			: "";
		return [race && className ? `${race} |` : race, className, levelPart]
			.filter(Boolean)
			.join(" ")
			.trim();
	}

	get notes() {
		const notes = Array.isArray(this.character.notes)
			? [...this.character.notes]
			: [];
		return notes.length > 0 ? notes : [createEmptyNote()];
	}

	get description() {
		return this.character.description || "";
	}

	get trait() {
		return this.character.trait || "";
	}

	get hasImage() {
		return Boolean(this.character.imageUrl);
	}

	get initialCategory() {
		return this.character.type === "npc" ? "tokens" : "characters";
	}

	get initialSubcategory() {
		return this.character.type === "npc" ? "npc" : "players";
	}

	withField(field, value) {
		return {
			...this.character,
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

	static getLevelOptions(max = 20) {
		return Array.from({ length: max }, (_, index) => index + 1);
	}
}
