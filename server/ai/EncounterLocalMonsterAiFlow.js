const { normalizeCustomMonster } = require("../aiCustomMonsterService");
const { asText } = require("./AiHistoryWriter");

function cloneJson(value) {
	return JSON.parse(JSON.stringify(value ?? null));
}

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function operationData(operation = {}) {
	return operation.data && typeof operation.data === "object"
		? operation.data
		: operation.monster && typeof operation.monster === "object"
			? operation.monster
			: operation.payload && typeof operation.payload === "object"
				? operation.payload
				: operation;
}

function operationPatch(operation = {}) {
	return operation.patch && typeof operation.patch === "object"
		? operation.patch
		: operation.changes && typeof operation.changes === "object"
			? operation.changes
			: operationData(operation);
}

function findMonsterOperation(generatedContent = {}) {
	return (
		Array.isArray(generatedContent.operations)
			? generatedContent.operations
			: []
	).find((operation) => {
		const entity = asText(operation?.entity).toLowerCase();
		const op = asText(operation?.op).toLowerCase();
		return (
			["monster", "custom-monster", "custommonster"].includes(entity) &&
			["create", "update"].includes(op)
		);
	});
}

function buildLocalEncounterMonsterFromOperation(
	generatedContent,
	targetMonster,
) {
	const operation = findMonsterOperation(generatedContent);
	if (!operation || !targetMonster) return null;
	const op = asText(operation.op).toLowerCase();
	const raw =
		op === "update"
			? {
					...targetMonster,
					...operationPatch(operation),
					id: targetMonster.id || operation.id || operation.targetId,
					name:
						operationPatch(operation).name ||
						targetMonster.name ||
						operation.name ||
						operation.targetName,
				}
			: {
					...targetMonster,
					...operationData(operation),
					id: operationData(operation).id || targetMonster.id,
					name: operationData(operation).name || targetMonster.name,
				};
	if (!hasOwn(raw, "originalBestiaryName")) {
		raw.originalBestiaryName =
			targetMonster.originalBestiaryName || targetMonster.name;
	}
	if (!hasOwn(raw, "imageUrl") && targetMonster.imageUrl) {
		raw.imageUrl = targetMonster.imageUrl;
	}
	return normalizeCustomMonster(raw);
}

function getMonsterMaxHp(monster = {}, fallback = 0) {
	const hpAverage =
		monster.hp && typeof monster.hp === "object"
			? Number.parseInt(monster.hp.average, 10)
			: NaN;
	const hitPoints = Number.parseInt(monster.hit_points, 10);
	const fallbackHp = Number.parseInt(fallback, 10);
	if (Number.isFinite(hpAverage)) return hpAverage;
	if (Number.isFinite(hitPoints)) return hitPoints;
	return Number.isFinite(fallbackHp) ? fallbackHp : 0;
}

function buildLocalEncounterMonsterSessionChange({
	campaignSlug,
	sessionFile,
	encounterId,
	targetInstanceId,
	beforeSession,
	nextMonster,
}) {
	if (!campaignSlug || !sessionFile || !encounterId || !targetInstanceId) {
		return null;
	}
	if (!beforeSession || !nextMonster) return null;

	const afterSession = cloneJson(beforeSession);
	const encounter = (afterSession.data?.encounters || []).find(
		(item) => asText(item?.id) === asText(encounterId),
	);
	if (!encounter || !Array.isArray(encounter.monsters)) return null;

	let changed = false;
	encounter.monsters = encounter.monsters.map((monster) => {
		if (asText(monster?.instanceId) !== asText(targetInstanceId))
			return monster;
		const nextMaxHp = getMonsterMaxHp(nextMonster, monster.hit_points);
		const currentHp = Number.parseInt(monster.currentHp, 10);
		const safeCurrentHp = Number.isFinite(currentHp)
			? Math.min(currentHp, nextMaxHp || currentHp)
			: nextMaxHp;
		changed = true;
		return {
			...nextMonster,
			instanceId: targetInstanceId,
			_localOverride: true,
			currentHp: safeCurrentHp,
			hit_points: nextMaxHp,
		};
	});
	if (!changed) return null;

	return {
		id: `session:${sessionFile}`,
		kind: "session",
		campaign: campaignSlug,
		fileName: sessionFile,
		label: `${campaignSlug}/sessions/${sessionFile}`,
		before: cloneJson(beforeSession),
		after: afterSession,
	};
}

class EncounterLocalMonsterAiFlow {
	constructor({ historyWriter, buildAiChangeSummary }) {
		this.historyWriter = historyWriter;
		this.buildAiChangeSummary = buildAiChangeSummary;
	}

	isEnabled(payload = {}) {
		const path = payload.path || {};
		return (
			payload.historyMode === "encounter" &&
			asText(path.campaign) &&
			asText(path.session) &&
			asText(path.encounter)
		);
	}

	async createDraft({
		payload,
		generatedContent,
		customMonsterTarget,
		customSession,
		modelName,
		responseLanguage,
		historyUserInstructions,
		customContextData,
		globalBasePrompt,
		imagePromptBasePrompt,
		campaignBasePrompt,
	}) {
		const path = payload.path || {};
		const targetInstanceId = asText(
			payload.targetInstanceId || customMonsterTarget?.instanceId,
		);
		const changedMonster = buildLocalEncounterMonsterFromOperation(
			generatedContent,
			customMonsterTarget,
		);
		const localEncounterResource = buildLocalEncounterMonsterSessionChange({
			campaignSlug: asText(path.campaign),
			sessionFile: asText(path.session),
			encounterId: asText(path.encounter),
			targetInstanceId,
			beforeSession: customSession,
			nextMonster: changedMonster,
		});

		if (!changedMonster || !localEncounterResource) {
			const aiResponse = await this.historyWriter.saveFailed(
				payload,
				{ message: "AI did not return any valid creature." },
				400,
			);
			return {
				status: 400,
				body: {
					error: "AI did not return any valid creature.",
					generated: generatedContent,
					aiResponse,
				},
			};
		}

		const responsePath = {
			campaign: asText(path.campaign),
			session: asText(path.session),
			encounter: asText(path.encounter),
		};
		const responseResources = [localEncounterResource];
		const aiResponsePayload = {
			text: this.historyWriter.formatGeneratedContent(generatedContent),
			path: responsePath,
			type: "custom-monster",
			modelName,
			language: responseLanguage,
			userInstructions: historyUserInstructions,
			request: this.historyWriter.buildRequestSnapshot({
				type: payload.type,
				modelName,
				userInstructions: historyUserInstructions,
				path: responsePath,
				parseAIResponse: true,
				shouldParseAIResponse: true,
				generateCharacters: false,
				generateNpcs: false,
				generateLocations: false,
				generateEncounters: false,
				generateCustomMonsters: false,
				entityScope: "custom-bestiary",
				contextConfig: null,
				contextData: customContextData,
				language: responseLanguage,
				globalBasePrompt,
				imagePromptBasePrompt,
				campaignBasePrompt,
			}),
			retryPayload: this.historyWriter.cloneRetryPayload(payload),
			changes: {
				resources: responseResources,
				summary: this.buildAiChangeSummary(responseResources),
			},
			applyState: "draft",
			appliedAt: null,
		};
		const aiResponse = await this.historyWriter.addResponse(aiResponsePayload);
		return {
			status: 200,
			body: {
				generated: {
					...generatedContent,
					monsters: [changedMonster],
				},
				draft: true,
				aiResponse,
			},
		};
	}
}

module.exports = {
	EncounterLocalMonsterAiFlow,
	buildLocalEncounterMonsterFromOperation,
	buildLocalEncounterMonsterSessionChange,
};
