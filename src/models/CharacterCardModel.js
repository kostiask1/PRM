import {
	createEmptyNote,
	upsertNoteById,
} from "../utils/noteUtils.js";

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
		values: "Date.now() або id з бекенду",
	},
	slug: { type: "string", values: "slug сутності на бекенді" },
	firstName: { type: "string", values: "Ім'я" },
	lastName: { type: "string", values: "Прізвище" },
	race: { type: "string", values: "Раса DnD" },
	class: { type: "string", values: "Клас DnD" },
	level: { type: "number|string", values: "1..20" },
	motivation: { type: "string", values: "Мотивація персонажа" },
	trait: { type: "string", values: "Особливість/звичка" },
	notes: {
		type: "CharacterNote[]",
		values: "Список нотаток, завжди має 1+ елемент",
	},
	collapsed: { type: "boolean", values: "Стан згортання картки" },
	isNotesCollapsed: { type: "boolean", values: "Стан згортання блоку нотаток" },
	imageUrl: { type: "string|null", values: "URL портрета" },
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
		return Number(this.character.level || 1);
	}

	get briefMeta() {
		const race = this.character.race || "";
		const className = this.character.class || "";
		const levelPart = this.character.level
			? `• Lvl. ${this.character.level}`
			: "";
		return `${race} ${className} ${levelPart}`.trim();
	}

	get notes() {
		return Array.isArray(this.character.notes) ? [...this.character.notes] : [];
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
		return this.notes.filter((note) => note.id !== noteId);
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
