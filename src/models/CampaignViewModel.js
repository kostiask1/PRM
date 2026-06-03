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
 * @property {Object[]} [locations]
 * @property {boolean} [isDescriptionCollapsed]
 * @property {boolean} [isNotesCollapsed]
 * @property {boolean} [isCharactersCollapsed]
 * @property {boolean} [isNpcsCollapsed]
 * @property {boolean} [isLocationsCollapsed]
 * @property {boolean} [completed]
 * @property {string|null} [completedAt]
 */

export const CAMPAIGN_FIELD_SCHEMA = {
	slug: {
		type: "string",
		required: true,
		values: "URL-safe campaign identifier",
	},
	name: { type: "string", required: true, values: "Campaign name" },
	createdAt: { type: "string", values: "ISO date-time" },
	description: { type: "string", values: "Campaign story text" },
	notes: { type: "CampaignNote[]", values: "Campaign notes" },
	characters: { type: "CharacterData[]", values: "Player characters" },
	npcs: { type: "CharacterData[]", values: "Campaign NPC entities" },
	locations: { type: "LocationData[]", values: "Campaign locations and factions" },
	isDescriptionCollapsed: { type: "boolean", values: "Description section collapsed state" },
	isNotesCollapsed: { type: "boolean", values: "Notes section collapsed state" },
	isCharactersCollapsed: { type: "boolean", values: "Characters section collapsed state" },
	isNpcsCollapsed: { type: "boolean", values: "NPC section collapsed state" },
	isLocationsCollapsed: {
		type: "boolean",
		values: "Locations and factions section collapsed state",
	},
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
}
