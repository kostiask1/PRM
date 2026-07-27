const {
	exists,
	readJson,
	writeJson,
} = require("../../infrastructure/jsonFileStore");
const {
	campaignAiResponsesPath,
	campaignMetaPath,
	sessionPath,
} = require("../../infrastructure/storagePaths");
const {
	listCampaignSlugs,
} = require("../campaign/campaignRepository");
const {
	ENTITY_TYPES,
	listEntities,
	writeEntity,
} = require("../entity/entityRepository");
const {
	listSessions,
} = require("../session/sessionRepository");

function replaceImageSlugReferences(value, oldSlug, newSlug) {
	if (!value || !oldSlug || !newSlug || oldSlug === newSlug) return value;
	const oldSegment = `/api/images/${encodeURIComponent(oldSlug)}/`;
	const newSegment = `/api/images/${encodeURIComponent(newSlug)}/`;
	const serialized = JSON.stringify(value);
	if (!serialized.includes(oldSegment)) return value;
	return JSON.parse(serialized.split(oldSegment).join(newSegment));
}

function replaceImageUrls(value, replacements) {
	if (!value || !Array.isArray(replacements) || replacements.length === 0) {
		return value;
	}
	let serialized = JSON.stringify(value);
	let changed = false;
	for (const replacement of replacements) {
		if (!replacement?.oldUrl || !serialized.includes(replacement.oldUrl)) {
			continue;
		}
		serialized = serialized
			.split(replacement.oldUrl)
			.join(replacement.newUrl);
		changed = true;
	}
	return changed ? JSON.parse(serialized) : value;
}

function createImageReferenceService(overrides = {}) {
	const dependencies = {
		campaignAiResponsesPath,
		campaignMetaPath,
		exists,
		listCampaignSlugs,
		listEntities,
		listSessions,
		readJson,
		sessionPath,
		writeEntity,
		writeJson,
		...overrides,
	};

	async function updateAllImageReferences(replacements = []) {
		if (!replacements.length) return;
		for (const slug of await dependencies.listCampaignSlugs()) {
			const metaPath = dependencies.campaignMetaPath(slug);
			if (await dependencies.exists(metaPath)) {
				const meta = await dependencies.readJson(metaPath);
				const normalized = replaceImageUrls(meta, replacements);
				if (normalized !== meta) {
					await dependencies.writeJson(metaPath, normalized);
				}
			}

			for (const type of ENTITY_TYPES) {
				for (const entity of await dependencies.listEntities(slug, type)) {
					const normalized = replaceImageUrls(entity, replacements);
					if (normalized !== entity) {
						await dependencies.writeEntity(
							slug,
							type,
							normalized.slug,
							normalized,
						);
					}
				}
			}

			for (const session of await dependencies.listSessions(slug)) {
				const filePath = dependencies.sessionPath(
					slug,
					session.fileName,
				);
				const data = await dependencies.readJson(filePath);
				const normalized = replaceImageUrls(data, replacements);
				if (normalized !== data) {
					await dependencies.writeJson(filePath, normalized);
				}
			}
		}
	}

	async function updateCampaignImageSlugReferences(oldSlug, newSlug) {
		if (!oldSlug || !newSlug || oldSlug === newSlug) return;
		for (const slug of await dependencies.listCampaignSlugs()) {
			const metaPath = dependencies.campaignMetaPath(slug);
			if (await dependencies.exists(metaPath)) {
				const meta = await dependencies.readJson(metaPath);
				const normalized = replaceImageSlugReferences(
					meta,
					oldSlug,
					newSlug,
				);
				if (normalized !== meta) {
					await dependencies.writeJson(metaPath, normalized);
				}
			}

			for (const type of ENTITY_TYPES) {
				for (const entity of await dependencies.listEntities(slug, type)) {
					const normalized = replaceImageSlugReferences(
						entity,
						oldSlug,
						newSlug,
					);
					if (normalized !== entity) {
						await dependencies.writeEntity(
							slug,
							type,
							normalized.slug,
							normalized,
						);
					}
				}
			}

			for (const session of await dependencies.listSessions(slug)) {
				const filePath = dependencies.sessionPath(
					slug,
					session.fileName,
				);
				const data = await dependencies.readJson(filePath);
				const normalized = replaceImageSlugReferences(
					data,
					oldSlug,
					newSlug,
				);
				if (normalized !== data) {
					await dependencies.writeJson(filePath, normalized);
				}
			}

			const aiPath = dependencies.campaignAiResponsesPath(slug);
			if (await dependencies.exists(aiPath)) {
				const data = await dependencies.readJson(aiPath);
				const normalized = replaceImageSlugReferences(
					data,
					oldSlug,
					newSlug,
				);
				if (normalized !== data) {
					await dependencies.writeJson(aiPath, normalized);
				}
			}
		}
	}

	return {
		updateAllImageReferences,
		updateCampaignImageSlugReferences,
	};
}

const imageReferenceService = createImageReferenceService();

module.exports = {
	...imageReferenceService,
	createImageReferenceService,
	replaceImageSlugReferences,
	replaceImageUrls,
};
