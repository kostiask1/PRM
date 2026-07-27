const crypto = require("crypto");
const { campaignSlug } = require("../../infrastructure/storagePaths");
const {
	coerceAiText: asText,
} = require("../../ai/textUtils");
const {
	getCharacterDisplayName,
} = require("../../ai/entityDisplayUtils");
const entityRepository = require("../entity/entityRepository");
const contentNormalizer = require("./aiContentNormalizer");
const campaignEntityGateway = require("./campaignEntityGateway");
const {
	entityTypeFromOperation,
	findByIdentity,
	getEntityDisplayName,
	getOperationTargetIdentity,
	getSessionEntityList,
	mapClientIdToEntity,
	operationScope,
	setSessionEntityList,
} = require("./entityOperationUtils");

function operationData(operation) {
	if (operation.data && typeof operation.data === "object") {
		return operation.data;
	}
	if (operation.value && typeof operation.value === "object") {
		return operation.value;
	}
	if (operation.patch && typeof operation.patch === "object") {
		return operation.patch;
	}
	return {};
}

function operationPatch(operation) {
	if (operation.patch && typeof operation.patch === "object") {
		return operation.patch;
	}
	if (operation.data && typeof operation.data === "object") {
		return operation.data;
	}
	return {};
}

function createEntityPatchService({
	createId = () => crypto.randomUUID(),
	createSlug = campaignSlug,
	entityGateway = campaignEntityGateway,
	normalizer = contentNormalizer,
	repository = entityRepository,
	text = asText,
	characterDisplayName = getCharacterDisplayName,
} = {}) {
	function normalizeEntityPayload(type, raw, existing, options) {
		return type === "locations"
			? normalizer.normalizeLocation(raw, existing, options)
			: normalizer.normalizeCharacter(raw, existing, options);
	}

	function mergeEntityPatch(existing, patch = {}) {
		return {
			...(existing || {}),
			...(patch && typeof patch === "object" ? patch : {}),
			id: existing?.id || patch?.id,
			slug: existing?.slug || patch?.slug,
			imageUrl: existing?.imageUrl ?? patch?.imageUrl ?? null,
		};
	}

	function buildDuplicateIdentity(type, rawData) {
		return {
			slug: rawData.slug,
			name: getEntityDisplayName(type, rawData),
		};
	}

	function mergeNewEntityVersion(type, rawData, existing, options) {
		const normalized = normalizeEntityPayload(
			type,
			{
				...rawData,
				id: existing?.id || rawData.id || createId(),
			},
			existing || null,
			options,
		);
		return {
			...(existing || {}),
			...normalized,
			id: existing?.id || normalized.id,
			slug: existing?.slug || normalized.slug || rawData.slug,
			imageUrl: normalized.imageUrl ?? existing?.imageUrl ?? null,
		};
	}

	function buildSessionEntityFromPayload(type, payload) {
		return {
			...payload,
			slug:
				payload.slug ||
				createSlug(
					type === "locations"
						? payload.name || "locations"
						: characterDisplayName(payload) || type,
				),
		};
	}

	function replaceSessionEntity(
		sessionData,
		type,
		existing,
		replacement,
	) {
		const list = getSessionEntityList(sessionData, type);
		const index = list.indexOf(existing);
		if (index >= 0) {
			list[index] = replacement;
		} else {
			list.push(replacement);
		}
		return replacement;
	}

	function removeSessionEntity(sessionData, type, existing) {
		const list = getSessionEntityList(sessionData, type);
		setSessionEntityList(
			sessionData,
			type,
			list.filter((item) => item !== existing),
		);
	}

	function isOperationAllowed(type, permissions) {
		if (type === "characters") {
			return permissions.allowCharacters !== false;
		}
		if (type === "npc") return permissions.allowNpcs !== false;
		if (type === "locations") {
			return permissions.allowLocations !== false;
		}
		return true;
	}

	function isValidEntity(type, entity) {
		if (type === "locations") return Boolean(entity.name);
		return Boolean(entity.firstName || entity.lastName);
	}

	async function applyCampaignEntityOperation(
		state,
		operation,
		type,
		options,
	) {
		const {
			campaignSlug: campaignSlugValue,
			clientIdMap,
			permissions,
			warnings,
		} = state;
		if (!isOperationAllowed(type, permissions)) {
			warnings.push(`Skipped ${operation.op} for disabled ${type}.`);
			return null;
		}
		const existingList =
			await entityGateway.readCampaignEntityList(
				campaignSlugValue,
				type,
			);
		const existing = findByIdentity(
			existingList,
			getOperationTargetIdentity(operation, clientIdMap),
			type,
		);
		const normalizedOp = text(operation.op).toLowerCase();

		if (normalizedOp === "delete") {
			if (!existing) return null;
			await repository.deleteEntity(
				campaignSlugValue,
				type,
				existing.slug,
			);
			return { type, scope: "campaign", deleted: existing };
		}

		if (normalizedOp === "create") {
			const rawData = {
				...operationData(operation),
				id: createId(),
			};
			const duplicate = findByIdentity(
				existingList,
				buildDuplicateIdentity(type, rawData),
				type,
			);
			if (duplicate) {
				const payload = mergeNewEntityVersion(
					type,
					rawData,
					duplicate,
					options,
				);
				if (!isValidEntity(type, payload)) return null;
				const saved = await entityGateway.writeCampaignEntity(
					campaignSlugValue,
					type,
					payload,
					duplicate,
				);
				mapClientIdToEntity(
					clientIdMap,
					operation,
					type,
					"campaign",
					saved,
				);
				warnings.push(
					`Replaced duplicate campaign ${type} with new AI version for "${getEntityDisplayName(
						type,
						saved,
					)}".`,
				);
				return { type, scope: "campaign", saved };
			}

			const sessionList = state.sessionData
				? getSessionEntityList(state.sessionData, type)
				: [];
			const duplicateSessionEntity = findByIdentity(
				sessionList,
				buildDuplicateIdentity(type, rawData),
				type,
			);
			if (duplicateSessionEntity) {
				const payload = mergeNewEntityVersion(
					type,
					rawData,
					duplicateSessionEntity,
					options,
				);
				if (!isValidEntity(type, payload)) return null;
				const saved = await entityGateway.writeCampaignEntity(
					campaignSlugValue,
					type,
					payload,
				);
				removeSessionEntity(
					state.sessionData,
					type,
					duplicateSessionEntity,
				);
				mapClientIdToEntity(
					clientIdMap,
					operation,
					type,
					"campaign",
					saved,
				);
				warnings.push(
					`Moved duplicate session ${type} to campaign with new AI version for "${getEntityDisplayName(
						type,
						saved,
					)}".`,
				);
				return {
					type,
					scope: "campaign",
					saved,
					sessionChanged: true,
				};
			}

			const normalized = normalizeEntityPayload(
				type,
				rawData,
				null,
				options,
			);
			if (!isValidEntity(type, normalized)) return null;
			const saved = await entityGateway.writeCampaignEntity(
				campaignSlugValue,
				type,
				normalized,
			);
			mapClientIdToEntity(
				clientIdMap,
				operation,
				type,
				"campaign",
				saved,
			);
			return { type, scope: "campaign", saved };
		}

		if (normalizedOp === "update") {
			if (!existing) return null;
			const oldDisplayName = getEntityDisplayName(type, existing);
			const raw = mergeEntityPatch(
				existing,
				operationPatch(operation),
			);
			const normalized = normalizeEntityPayload(
				type,
				raw,
				existing,
				options,
			);
			const payload = {
				...existing,
				...normalized,
				id: existing.id,
				slug: existing.slug,
				imageUrl:
					existing.imageUrl ?? normalized.imageUrl ?? null,
			};
			const saved = await entityGateway.writeCampaignEntity(
				campaignSlugValue,
				type,
				payload,
				existing,
			);
			const newDisplayName = getEntityDisplayName(type, saved);
			if (
				oldDisplayName &&
				newDisplayName &&
				oldDisplayName !== newDisplayName
			) {
				await repository.updateCampaignMentionReferences(
					campaignSlugValue,
					oldDisplayName,
					newDisplayName,
				);
			}
			return { type, scope: "campaign", saved };
		}

		return null;
	}

	async function applySessionEntityOperation(
		state,
		operation,
		type,
		options,
	) {
		const {
			campaignSlug: campaignSlugValue,
			sessionData,
			clientIdMap,
			permissions,
			warnings,
		} = state;
		if (!sessionData) {
			warnings.push(
				`Skipped session ${operation.op}; no session target.`,
			);
			return null;
		}
		if (!isOperationAllowed(type, permissions)) {
			warnings.push(`Skipped ${operation.op} for disabled ${type}.`);
			return null;
		}

		const list = getSessionEntityList(sessionData, type);
		const existing = findByIdentity(
			list,
			getOperationTargetIdentity(operation, clientIdMap),
			type,
		);
		const normalizedOp = text(operation.op).toLowerCase();

		if (normalizedOp === "delete") {
			if (!existing) return null;
			setSessionEntityList(
				sessionData,
				type,
				list.filter((item) => item !== existing),
			);
			return { type, scope: "session", deleted: existing };
		}

		if (normalizedOp === "create") {
			const rawData = {
				...operationData(operation),
				id: createId(),
			};
			const duplicateSessionEntity = findByIdentity(
				list,
				buildDuplicateIdentity(type, rawData),
				type,
			);
			if (duplicateSessionEntity) {
				const payload = mergeNewEntityVersion(
					type,
					rawData,
					duplicateSessionEntity,
					options,
				);
				if (!isValidEntity(type, payload)) return null;
				const saved = replaceSessionEntity(
					sessionData,
					type,
					duplicateSessionEntity,
					buildSessionEntityFromPayload(type, payload),
				);
				mapClientIdToEntity(
					clientIdMap,
					operation,
					type,
					"session",
					saved,
				);
				warnings.push(
					`Replaced duplicate session ${type} with new AI version for "${getEntityDisplayName(
						type,
						saved,
					)}".`,
				);
				return { type, scope: "session", saved };
			}

			const campaignEntities = campaignSlugValue
				? await entityGateway
						.readCampaignEntityList(campaignSlugValue, type)
						.catch(() => [])
				: [];
			const duplicateCampaignEntity = findByIdentity(
				campaignEntities,
				buildDuplicateIdentity(type, rawData),
				type,
			);
			if (duplicateCampaignEntity) {
				const payload = mergeNewEntityVersion(
					type,
					rawData,
					duplicateCampaignEntity,
					options,
				);
				if (!isValidEntity(type, payload)) return null;
				const saved = buildSessionEntityFromPayload(type, payload);
				list.push(saved);
				await repository.deleteEntity(
					campaignSlugValue,
					type,
					duplicateCampaignEntity.slug,
				);
				mapClientIdToEntity(
					clientIdMap,
					operation,
					type,
					"session",
					saved,
				);
				warnings.push(
					`Moved duplicate campaign ${type} to session with new AI version for "${getEntityDisplayName(
						type,
						saved,
					)}".`,
				);
				return { type, scope: "session", saved };
			}

			const normalized = normalizeEntityPayload(
				type,
				rawData,
				null,
				options,
			);
			if (!isValidEntity(type, normalized)) return null;
			const saved = buildSessionEntityFromPayload(type, normalized);
			list.push(saved);
			mapClientIdToEntity(
				clientIdMap,
				operation,
				type,
				"session",
				saved,
			);
			return { type, scope: "session", saved };
		}

		if (normalizedOp === "update") {
			if (!existing) return null;
			const raw = mergeEntityPatch(
				existing,
				operationPatch(operation),
			);
			const normalized = normalizeEntityPayload(
				type,
				raw,
				existing,
				options,
			);
			const saved = {
				...existing,
				...normalized,
				id: existing.id,
				slug: existing.slug,
				imageUrl:
					existing.imageUrl ?? normalized.imageUrl ?? null,
			};
			const index = list.indexOf(existing);
			list[index] = saved;
			return { type, scope: "session", saved };
		}

		return null;
	}

	async function applyMoveScopeOperation(
		state,
		operation,
		type,
		options,
	) {
		const {
			campaignSlug: campaignSlugValue,
			sessionData,
			warnings,
		} = state;
		if (!sessionData) {
			warnings.push("Skipped moveScope; no session target.");
			return null;
		}
		const from = text(operation.from || operation.scope).toLowerCase();
		const to = text(
			operation.to || operation.targetScope,
		).toLowerCase();
		if (
			!["campaign", "session"].includes(from) ||
			!["campaign", "session"].includes(to)
		) {
			warnings.push("Skipped moveScope with invalid scope.");
			return null;
		}
		if (from === to) return null;

		if (from === "session") {
			const list = getSessionEntityList(sessionData, type);
			const existing = findByIdentity(
				list,
				getOperationTargetIdentity(
					operation,
					state.clientIdMap,
				),
				type,
			);
			if (!existing) return null;
			const campaignEntities =
				await entityGateway.readCampaignEntityList(
					campaignSlugValue,
					type,
				);
			const duplicateCampaignEntity = findByIdentity(
				campaignEntities,
				buildDuplicateIdentity(type, existing),
				type,
			);
			const payload = mergeNewEntityVersion(
				type,
				existing,
				duplicateCampaignEntity || existing,
				options,
			);
			const saved = await entityGateway.writeCampaignEntity(
				campaignSlugValue,
				type,
				payload,
				duplicateCampaignEntity,
			);
			removeSessionEntity(sessionData, type, existing);
			if (duplicateCampaignEntity) {
				warnings.push(
					`Replaced duplicate campaign ${type} during moveScope with "${getEntityDisplayName(
						type,
						saved,
					)}".`,
				);
			}
			return { type, moved: true, from, to, saved };
		}

		const campaignEntities =
			await entityGateway.readCampaignEntityList(
				campaignSlugValue,
				type,
			);
		const existing = findByIdentity(
			campaignEntities,
			getOperationTargetIdentity(
				operation,
				state.clientIdMap,
			),
			type,
		);
		if (!existing) return null;
		const list = getSessionEntityList(sessionData, type);
		const duplicateSessionEntity = findByIdentity(
			list,
			buildDuplicateIdentity(type, existing),
			type,
		);
		const payload = mergeNewEntityVersion(
			type,
			existing,
			duplicateSessionEntity || existing,
			options,
		);
		const saved = duplicateSessionEntity
			? replaceSessionEntity(
					sessionData,
					type,
					duplicateSessionEntity,
					buildSessionEntityFromPayload(type, payload),
				)
			: buildSessionEntityFromPayload(type, payload);
		if (!duplicateSessionEntity) {
			list.push(saved);
		} else {
			warnings.push(
				`Replaced duplicate session ${type} during moveScope with "${getEntityDisplayName(
					type,
					saved,
				)}".`,
			);
		}
		await repository.deleteEntity(
			campaignSlugValue,
			type,
			existing.slug,
		);
		return { type, moved: true, from, to, saved };
	}

	async function applyEntityOperation(state, operation, options) {
		const type = entityTypeFromOperation(operation.entity);
		if (!type) return null;
		if (text(operation.op).toLowerCase() === "movescope") {
			return applyMoveScopeOperation(
				state,
				operation,
				type,
				options,
			);
		}
		const defaultScope =
			type === "characters" ? "campaign" : state.defaultEntityScope;
		const scope = operationScope(
			operation,
			defaultScope,
			state.clientIdMap,
		);
		if (scope === "session" && type !== "characters") {
			return applySessionEntityOperation(
				state,
				operation,
				type,
				options,
			);
		}
		return applyCampaignEntityOperation(
			state,
			operation,
			type,
			options,
		);
	}

	return {
		applyCampaignEntityOperation,
		applyEntityOperation,
		applyMoveScopeOperation,
		applySessionEntityOperation,
	};
}

const { applyEntityOperation } = createEntityPatchService();

module.exports = {
	applyEntityOperation,
	createEntityPatchService,
};
