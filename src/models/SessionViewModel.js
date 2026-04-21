import { idsEqual } from "../utils/id";

const SCENE_SCHEMA = [
	{
		key: "summary",
		title: "Суть сцени",
		type: "textarea",
		placeholder: "Коротко опиши сцену...",
	},
	{
		key: "goal",
		title: "Мета гравців",
		type: "textarea",
		placeholder: "Чого персонажі хочуть досягти...",
	},
	{
		key: "stakes",
		title: "Ставки",
		type: "textarea",
		placeholder: "Що буде при успіху/провалі...",
	},
	{
		key: "location",
		title: "Локація",
		type: "textarea",
		placeholder: "Де це відбувається...",
	},
];

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
 * @property {boolean} [completed]
 * @property {string|null} [completedAt]
 * @property {SessionDataPayload} data
 * @property {boolean} [isSaving]
 */

export const SESSION_FIELD_SCHEMA = {
	fileName: { type: "string", required: true, values: "Ідентифікатор файлу сесії" },
	name: { type: "string", required: true, values: "Назва сесії" },
	completed: { type: "boolean", values: "Статус завершення" },
	completedAt: { type: "string|null", values: "ISO date-time завершення" },
	data: {
		type: "SessionDataPayload",
		values: "Контент сесії: notes, scenes, encounters, result_text, *_check",
	},
	isSaving: { type: "boolean", values: "Локальний стан автозбереження" },
};

export default class SessionViewModel {
	/** @param {SessionData} session */
	constructor(session = {}) {
		this.session = session;
	}

	static get schema() {
		return SESSION_FIELD_SCHEMA;
	}

	static get sceneSchema() {
		return SCENE_SCHEMA;
	}

	get data() {
		return this.session;
	}

	get isCompleted() {
		return Boolean(this.session.completed);
	}

	get completeButtonLabel() {
		return this.isCompleted ? "Відновити" : "Завершити";
	}

	get saveStatusLabel() {
		return this.session.isSaving ? "Зберігання..." : "Всі зміни збережено";
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
	findEncounterName(scene) {
		const entry = this.encounters.find(
			(encounter) =>
				idsEqual(encounter.id, scene.encounterId),
		);
		return entry?.name || "Без назви";
	}
}
