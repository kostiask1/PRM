import { CardNoteModel } from "./cardNoteModelUtils.js";

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

export default class LocationCardModel extends CardNoteModel {
	/** @param {LocationData} location */
	constructor(location = {}) {
		super();
		this.location = location;
	}

	get entity() {
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

}
