/**
 * Campaign note schema.
 * @typedef {Object} CampaignNote
 * @property {number|string} id
 * @property {string} title
 * @property {string} text
 * @property {boolean} collapsed
 */

/**
 * Session list item shown in CampaignView.
 * @typedef {Object} CampaignSessionItem
 * @property {string} fileName
 * @property {string} name
 * @property {string} [updatedAt]
 * @property {boolean} [completed]
 * @property {string|null} [completedAt]
 */

/**
 * Campaign schema inferred from withCampaignView.
 * @typedef {Object} CampaignData
 * @property {string} slug
 * @property {string} name
 * @property {string} [createdAt]
 * @property {string} [description]
 * @property {CampaignNote[]} [notes]
 * @property {Object[]} [characters]
 * @property {Object[]} [npcs]
 * @property {boolean} [isDescriptionCollapsed]
 * @property {boolean} [isNotesCollapsed]
 * @property {boolean} [isCharactersCollapsed]
 * @property {boolean} [isNpcsCollapsed]
 * @property {boolean} [completed]
 * @property {string|null} [completedAt]
 */

export const CAMPAIGN_FIELD_SCHEMA = {
	slug: {
		type: "string",
		required: true,
		values: "URL-safe ідентифікатор кампанії",
	},
	name: { type: "string", required: true, values: "Назва кампанії" },
	createdAt: { type: "string", values: "ISO date-time" },
	description: { type: "string", values: "Текст сюжету кампанії" },
	notes: { type: "CampaignNote[]", values: "Замітки кампанії" },
	characters: { type: "CharacterData[]", values: "Персонажі гравців" },
	npcs: { type: "CharacterData[]", values: "NPC сутності кампанії" },
	isDescriptionCollapsed: { type: "boolean", values: "Стан секції опису" },
	isNotesCollapsed: { type: "boolean", values: "Стан секції заміток" },
	isCharactersCollapsed: { type: "boolean", values: "Стан секції персонажів" },
	isNpcsCollapsed: { type: "boolean", values: "Стан секції NPC" },
};

export default class CampaignViewModel {
	/** @param {CampaignData} campaign */
	constructor(campaign = {}) {
		this.campaign = campaign;
	}

	static get schema() {
		return CAMPAIGN_FIELD_SCHEMA;
	}

	get data() {
		return this.campaign;
	}

	get name() {
		return this.campaign.name || "";
	}

	get createdAtLabel() {
		if (!this.campaign.createdAt) return "-";
		return new Date(this.campaign.createdAt).toLocaleDateString();
	}

	/** @param {string} fileName */
	buildSessionHref(fileName) {
		return `/campaign/${encodeURIComponent(this.campaign.slug)}/session/${encodeURIComponent(fileName)}`;
	}

	/** @param {string} updatedAt */
	formatSessionUpdatedAt(updatedAt) {
		if (!updatedAt) return "-";
		return new Date(updatedAt).toLocaleDateString();
	}
}
