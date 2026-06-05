import { CardNoteModel } from "./cardNoteModelUtils.js";

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

export default class CharacterCardModel extends CardNoteModel {
	/** @param {CharacterData} character */
	constructor(character = {}) {
		super();
		this.character = character;
	}

	get entity() {
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

		return [race && className ? `${race} |` : race, className]
			.filter(Boolean)
			.join(" ")
			.trim();
	}

	get description() {
		return this.character.description || "";
	}

	get trait() {
		return this.character.trait || "";
	}

	static getLevelOptions(max = 20) {
		return Array.from({ length: max }, (_, index) => index + 1);
	}
}
