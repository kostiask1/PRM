const path = require("path");
const crypto = require("crypto");
const {
	exists,
	getFileSize,
	readJson,
	writeJson,
} = require("../../infrastructure/jsonFileStore");
const {
	aiResponsesPath,
	campaignAiResponsesPath,
} = require("../../infrastructure/storagePaths");

function hasOwn(value, key) {
	return Boolean(
		value &&
		typeof value === "object" &&
		Object.prototype.hasOwnProperty.call(value, key),
	);
}

function createAiResponseRepository(overrides = {}) {
	const dependencies = {
		aiResponsesPath,
		campaignAiResponsesPath,
		createId: () => crypto.randomUUID(),
		exists,
		getFileSize,
		readJson,
		writeJson,
		...overrides,
	};
	const legacyMigrationPromises = new Map();

	function normalizeAiChangeResource(raw = {}) {
		if (!raw || typeof raw !== "object") return null;
		const kind = [
			"campaign",
			"session",
			"entity",
			"custom-bestiary",
			"custom-monster",
		].includes(raw.kind)
			? raw.kind
			: null;
		if (!kind) return null;

		const before = hasOwn(raw, "before") ? raw.before : null;
		const after = hasOwn(raw, "after") ? raw.after : null;
		if (before === null && after === null) return null;

		const resource = {
			id: String(raw.id || dependencies.createId()),
			kind,
			campaign: raw.campaign || null,
			label: String(raw.label || raw.id || kind),
			before,
			after,
			applyState: ["applied", "undone"].includes(raw.applyState)
				? raw.applyState
				: null,
			appliedAt: raw.appliedAt || null,
		};

		if (kind === "session") {
			resource.fileName = raw.fileName || null;
		} else if (kind === "entity") {
			resource.type = raw.type || null;
			resource.slug = raw.slug || null;
		} else if (kind === "custom-monster") {
			resource.name = raw.name || raw.after?.name || raw.before?.name || null;
		}

		return resource;
	}

	function normalizeAiChanges(raw = {}) {
		if (!raw || typeof raw !== "object") {
			return { resources: [], summary: {} };
		}
		const resources = Array.isArray(raw.resources)
			? raw.resources.map(normalizeAiChangeResource).filter(Boolean)
			: [];
		return {
			resources,
			summary:
				raw.summary && typeof raw.summary === "object" ? raw.summary : {},
		};
	}

	function normalizeAiResponse(raw = {}) {
		const text = typeof raw.text === "string" ? raw.text : "";
		if (!text.trim()) return null;
		const rawRequest =
			raw.request && typeof raw.request === "object" ? raw.request : {};
		const userInstructions =
			typeof rawRequest.userInstructions === "string"
				? rawRequest.userInstructions
				: typeof raw.userInstructions === "string"
					? raw.userInstructions
					: "";
		const request = {
			userInstructions,
			options:
				rawRequest.options && typeof rawRequest.options === "object"
					? rawRequest.options
					: {},
			optionsSummary:
				typeof rawRequest.optionsSummary === "string"
					? rawRequest.optionsSummary
					: "",
			context:
				rawRequest.context && typeof rawRequest.context === "object"
					? rawRequest.context
					: {},
			contextSummary:
				typeof rawRequest.contextSummary === "string"
					? rawRequest.contextSummary
					: "",
		};
		const changes = normalizeAiChanges(raw.changes);
		const applyState = ["applied", "undone", "draft"].includes(raw.applyState)
			? raw.applyState
			: null;
		const status = raw.status === "failed" ? "failed" : "completed";

		return {
			id: String(raw.id || dependencies.createId()),
			text,
			status,
			path:
				raw.path && typeof raw.path === "object"
					? {
							campaign: raw.path.campaign || null,
							session: raw.path.session || null,
							encounter: raw.path.encounter || null,
						}
					: null,
			type: raw.type || null,
			modelName: raw.modelName || null,
			language: raw.language || null,
			userInstructions,
			request,
			changes,
			applyState,
			appliedAt: raw.appliedAt || null,
			error:
				raw.error && typeof raw.error === "object"
					? {
							message: String(raw.error.message || ""),
							status: raw.error.status || null,
						}
					: null,
			retryPayload:
				raw.retryPayload && typeof raw.retryPayload === "object"
					? raw.retryPayload
					: null,
			createdAt: raw.createdAt || new Date().toISOString(),
		};
	}

	function normalizeCampaignSlug(slug) {
		const normalized = path.basename(String(slug || "").trim());
		return normalized || null;
	}

	function normalizeAiResponseList(saved) {
		const list = Array.isArray(saved)
			? saved
			: Array.isArray(saved?.responses)
				? saved.responses
				: [];
		return list
			.map(normalizeAiResponse)
			.filter(Boolean)
			.sort((a, b) =>
				String(b.createdAt).localeCompare(String(a.createdAt)),
			);
	}

	async function migrateLegacyBestiaryResponses(slug) {
		const responsesPath = dependencies.aiResponsesPath(slug);
		if (slug !== "bestiary" || (await dependencies.exists(responsesPath))) {
			return { responsesPath };
		}

		const legacyResponsesPath = dependencies.campaignAiResponsesPath(slug);
		if (!(await dependencies.exists(legacyResponsesPath))) {
			return { responsesPath };
		}

		let responses;
		try {
			const saved = await dependencies.readJson(legacyResponsesPath);
			responses = normalizeAiResponseList(saved);
		} catch {
			return { responsesPath };
		}

		try {
			await dependencies.writeJson(responsesPath, responses);
			return { responses, responsesPath };
		} catch {
			return { responses, responsesPath };
		}
	}

	async function ensureCanonicalAiResponses(slug) {
		const migrationKey = String(slug);
		const pendingMigration = legacyMigrationPromises.get(migrationKey);
		if (pendingMigration) return pendingMigration;

		const migration = migrateLegacyBestiaryResponses(slug);
		legacyMigrationPromises.set(migrationKey, migration);
		try {
			return await migration;
		} finally {
			if (legacyMigrationPromises.get(migrationKey) === migration) {
				legacyMigrationPromises.delete(migrationKey);
			}
		}
	}

	async function readAiResponses(campaignSlugValue) {
		const slug = normalizeCampaignSlug(campaignSlugValue);
		if (!slug) return [];
		const migration = await ensureCanonicalAiResponses(slug);
		if (migration.responses) return migration.responses;
		if (!(await dependencies.exists(migration.responsesPath))) return [];
		try {
			const saved = await dependencies.readJson(migration.responsesPath);
			return normalizeAiResponseList(saved);
		} catch {
			return [];
		}
	}

	async function getAiResponsesStorageStats(campaignSlugValue) {
		const slug = normalizeCampaignSlug(campaignSlugValue);
		if (!slug) return { bytes: 0 };
		const migration = await ensureCanonicalAiResponses(slug);
		return {
			bytes: await dependencies.getFileSize(migration.responsesPath),
		};
	}

	async function writeAiResponses(campaignSlugValue, responses) {
		const slug = normalizeCampaignSlug(campaignSlugValue);
		if (!slug) return [];
		const normalized = normalizeAiResponseList(
			Array.isArray(responses) ? responses : [],
		);
		await dependencies.writeJson(dependencies.aiResponsesPath(slug), normalized);
		return normalized;
	}

	async function addAiResponse(payload) {
		const campaignSlugValue = payload?.path?.campaign;
		const responses = await readAiResponses(campaignSlugValue);
		const entry = normalizeAiResponse({
			...payload,
			id: dependencies.createId(),
			createdAt: new Date().toISOString(),
		});
		if (!entry) {
			throw new Error("AI response text is required.");
		}
		await writeAiResponses(campaignSlugValue, [entry, ...responses]);
		return entry;
	}

	async function getAiResponse(campaignSlugValue, id) {
		const responses = await readAiResponses(campaignSlugValue);
		return responses.find((entry) => entry.id === String(id)) || null;
	}

	async function updateAiResponse(campaignSlugValue, id, patch = {}) {
		const responses = await readAiResponses(campaignSlugValue);
		let updatedEntry = null;
		const next = responses.map((entry) => {
			if (entry.id !== String(id)) return entry;
			updatedEntry = normalizeAiResponse({
				...entry,
				...patch,
				id: entry.id,
				createdAt: entry.createdAt,
			});
			return updatedEntry || entry;
		});
		if (!updatedEntry) return null;
		await writeAiResponses(campaignSlugValue, next);
		return updatedEntry;
	}

	async function deleteAiResponse(campaignSlugValue, id) {
		const responses = await readAiResponses(campaignSlugValue);
		const next = responses.filter((entry) => entry.id !== String(id));
		await writeAiResponses(campaignSlugValue, next);
		return next;
	}

	async function clearAiResponses(campaignSlugValue) {
		await writeAiResponses(campaignSlugValue, []);
		return [];
	}

	return {
		addAiResponse,
		clearAiResponses,
		deleteAiResponse,
		getAiResponse,
		getAiResponsesStorageStats,
		normalizeAiResponse,
		readAiResponses,
		updateAiResponse,
		writeAiResponses,
	};
}

const aiResponseRepository = createAiResponseRepository();

module.exports = {
	...aiResponseRepository,
	createAiResponseRepository,
};
