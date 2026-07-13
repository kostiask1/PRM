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

export default class CampaignViewModel {
	/** @param {CampaignData} campaign */
	constructor(campaign = {}) {
		this.campaign = campaign;
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
