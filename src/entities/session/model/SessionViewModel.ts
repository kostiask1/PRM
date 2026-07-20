import { idsEqual } from "../../../shared/lib/index.js";

export interface SessionSceneField {
	key: string;
	title: string;
	type: "textarea";
	placeholder: string;
}

const SCENE_SCHEMA = [
	{
		key: "summary",
		title: "Scene summary",
		type: "textarea",
		placeholder: "Briefly describe the scene...",
	},
	{
		key: "goal",
		title: "Players' goal",
		type: "textarea",
		placeholder: "What do the characters want to achieve...",
	},
	{
		key: "stakes",
		title: "Stakes",
		type: "textarea",
		placeholder: "What happens on success or failure...",
	},
	{
		key: "location",
		title: "Location",
		type: "textarea",
		placeholder: "Where does this happen...",
	},
] satisfies readonly SessionSceneField[];

export type SessionDomainId = string | number;

export interface SessionNote extends Record<string, unknown> {
	id: SessionDomainId;
	title?: string;
	text?: string;
	collapsed?: boolean;
}

export interface SessionScene extends Record<string, unknown> {
	id: SessionDomainId;
	collapsed?: boolean;
	texts?: Record<string, unknown>;
	notes?: SessionNote[];
	isNotesCollapsed?: boolean;
	imageUrl?: string | null;
	encounterId?: SessionDomainId | null;
}

export interface SessionEncounter extends Record<string, unknown> {
	id: SessionDomainId;
	name?: string;
	monsters?: Record<string, unknown>[];
}

export interface SessionDataPayload extends Record<string, unknown> {
	notes?: SessionNote[];
	scenes?: SessionScene[];
	encounters?: SessionEncounter[];
	npcs?: Record<string, unknown>[];
	locations?: Record<string, unknown>[];
	result_text?: string;
}

export interface SessionViewData extends Record<string, unknown> {
	fileName?: string;
	name?: string;
	data?: SessionDataPayload;
	isSaving?: boolean;
}

/**
 * @typedef {Object} SessionNote
 * @property {number|string} id
 * @property {string} title
 * @property {string} text
 * @property {boolean} collapsed
 */

/**
 * @typedef {Object} SessionScene
 * @property {number|string} id
 * @property {boolean} collapsed
 * @property {{summary?: string, goal?: string, stakes?: string, location?: string, [key: string]: string}} [texts]
 * @property {SessionNote[]} [notes]
 * @property {boolean} [isNotesCollapsed]
 * @property {string|null} [imageUrl]
 * @property {string|number|null} [encounterId]
 */

/**
 * @typedef {Object} SessionEncounter
 * @property {string|number} id
 * @property {string} name
 * @property {Array<Object>} monsters
 */

/**
 * Session payload schema inferred from withSessionView.
 * @typedef {Object} SessionDataPayload
 * @property {SessionNote[]} [notes]
 * @property {SessionScene[]} [scenes]
 * @property {SessionEncounter[]} [encounters]
 * @property {Object[]} [npcs]
 * @property {Object[]} [locations]
 * @property {string} [result_text]
 * @property {boolean} [isNotesCollapsed]
 * @property {boolean} [goal_check]
 * @property {boolean} [conflict_check]
 * @property {boolean} [social_check]
 * @property {boolean} [exploration_check]
 * @property {boolean} [combat_check]
 */

/**
 * Session schema inferred from withSessionView.
 * @typedef {Object} SessionData
 * @property {string} fileName
 * @property {string} name
 * @property {SessionDataPayload} data
 * @property {boolean} [isSaving]
 */

export default class SessionViewModel {
	readonly session: SessionViewData;

	/** @param {SessionData} session */
	constructor(session: SessionViewData = {}) {
		this.session = session;
	}

	static get sceneSchema() {
		return SCENE_SCHEMA;
	}

	get notes() {
		return this.session?.data?.notes || [];
	}

	get scenes() {
		return this.session?.data?.scenes || [];
	}

	get encounters() {
		return this.session?.data?.encounters || [];
	}

	/** @param {SessionScene} scene */
	findEncounterName(scene: SessionScene): string {
		const entry = this.encounters.find((encounter) =>
			idsEqual(encounter.id, scene.encounterId),
		);
		return entry?.name || "Untitled";
	}
}
