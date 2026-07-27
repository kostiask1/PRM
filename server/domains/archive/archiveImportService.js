const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const {
	ensureDir,
	exists,
	readJson,
	writeJson,
} = require("../../infrastructure/jsonFileStore");
const {
	CAMPAIGNS_DIR,
	IMAGES_DIR,
	campaignDir,
	campaignMetaPath,
	campaignSlug,
	sanitizeName,
	sessionFileName,
	sessionPath,
	todayString,
} = require("../../infrastructure/storagePaths");
const {
	readAiResponses,
	writeAiResponses,
} = require("../ai/aiResponseRepository");
const {
	deleteCampaignData,
} = require("../campaign/campaignLifecycleService");
const {
	ensureUniqueCampaignSlug,
	listCampaignSlugs,
} = require("../campaign/campaignRepository");
const {
	ENTITY_TYPES,
	ensureUniqueEntitySlug,
	writeEntity,
} = require("../entity/entityRepository");
const {
	replaceImageSlugReferences,
} = require("../image/imageReferenceService");
const {
	ensureUniqueSessionFile,
	listSessions,
} = require("../session/sessionRepository");
const {
	normalizePartialArchiveSections,
} = require("./archiveSections");

function replaceCampaignSlugFields(value, oldSlug, newSlug) {
	if (!value || !oldSlug || !newSlug || oldSlug === newSlug) return value;
	if (Array.isArray(value)) {
		return value.map((item) =>
			replaceCampaignSlugFields(item, oldSlug, newSlug),
		);
	}
	if (typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			key,
			["slug", "campaign"].includes(key) && item === oldSlug
				? newSlug
				: replaceCampaignSlugFields(item, oldSlug, newSlug),
		]),
	);
}

function createArchiveImportService(overrides = {}) {
	const dependencies = {
		campaignDir,
		campaignMetaPath,
		campaignSlug,
		campaignsDir: CAMPAIGNS_DIR,
		createId: () => crypto.randomUUID(),
		deleteCampaignData,
		ensureDir,
		ensureUniqueCampaignSlug,
		ensureUniqueEntitySlug,
		ensureUniqueSessionFile,
		exists,
		imagesDir: IMAGES_DIR,
		listCampaignSlugs,
		listSessions,
		now: () => new Date(),
		readAiResponses,
		readJson,
		remove: fs.rm,
		replaceImageSlugReferences,
		sanitizeName,
		sessionFileName,
		sessionPath,
		todayString,
		writeAiResponses,
		writeEntity,
		writeFile: fs.writeFile,
		writeJson,
		...overrides,
	};

	function importedSessionFileName(session) {
		const rawFileName = String(session?.fileName || "").trim();
		if (rawFileName) {
			const parsed = path.parse(path.basename(rawFileName));
			const name = dependencies.sanitizeName(parsed.name);
			if (name) return `${name}.json`;
		}
		return dependencies.sessionFileName(
			session?.content?.name || dependencies.todayString(),
		);
	}

	async function resolvePartialImportSessionFileName(targetSlug, session) {
		const incomingId = session?.content?.id;
		if (incomingId != null) {
			const existing = (await dependencies.listSessions(targetSlug)).find(
				(item) =>
					item.id != null &&
					String(item.id) === String(incomingId),
			);
			if (existing?.fileName) return existing.fileName;
		}
		return importedSessionFileName(session);
	}

	function importedEntitySlug(type, entity) {
		const rawSlug = String(entity?.slug || "").trim();
		if (rawSlug) {
			const slug = path.basename(rawSlug);
			if (slug && slug !== "." && slug !== "..") return slug;
		}
		return dependencies.campaignSlug(
			entity?.firstName || entity?.name || type,
		);
	}

	async function findCampaignSlugById(campaignId) {
		if (!campaignId) return null;
		for (const slug of await dependencies.listCampaignSlugs()) {
			const metaPath = dependencies.campaignMetaPath(slug);
			if (!(await dependencies.exists(metaPath))) continue;
			const meta = await dependencies.readJson(metaPath);
			if (String(meta.id) === String(campaignId)) return slug;
		}
		return null;
	}

	async function clearAllCampaignData() {
		await dependencies.remove(dependencies.campaignsDir, {
			recursive: true,
			force: true,
		});
		await dependencies.remove(dependencies.imagesDir, {
			recursive: true,
			force: true,
		});
		await dependencies.ensureDir(dependencies.campaignsDir);
		await dependencies.ensureDir(dependencies.imagesDir);
	}

	function normalizeImportedAiResponse(entry, sourceSlug, slug) {
		const withImageRefs = dependencies.replaceImageSlugReferences(
			entry,
			sourceSlug,
			slug,
		);
		const withCampaignRefs = replaceCampaignSlugFields(
			withImageRefs,
			sourceSlug,
			slug,
		);
		return {
			...withCampaignRefs,
			path:
				withCampaignRefs?.path &&
				typeof withCampaignRefs.path === "object"
					? { ...withCampaignRefs.path, campaign: slug }
					: { campaign: slug, session: null, encounter: null },
			changes: {
				...(withCampaignRefs?.changes || {}),
				resources: Array.isArray(
					withCampaignRefs?.changes?.resources,
				)
					? withCampaignRefs.changes.resources.map((resource) => ({
							...resource,
							campaign: slug,
							label:
								typeof resource.label === "string"
									? resource.label.replace(
											sourceSlug,
											slug,
										)
									: resource.label,
						}))
					: [],
			},
		};
	}

	async function importCampaignBundle(bundle, options = {}) {
		const { meta, sessions = [], entities = {}, aiResponses = [] } = bundle;
		if (!meta || !meta.name) throw new Error("Invalid bundle format.");
		const sourceSlug =
			meta.slug || dependencies.campaignSlug(meta.name);
		const forcedSlug = options.forcedSlug
			? path.basename(options.forcedSlug)
			: null;
		const slug =
			forcedSlug ||
			(await dependencies.ensureUniqueCampaignSlug(
				dependencies.campaignSlug(meta.name),
			));
		if (
			forcedSlug &&
			options.replaceExisting &&
			(await dependencies.exists(dependencies.campaignDir(slug)))
		) {
			await dependencies.deleteCampaignData(slug);
		}
		const newMeta = {
			...dependencies.replaceImageSlugReferences(
				meta,
				sourceSlug,
				slug,
			),
			slug,
			createdAt: meta.createdAt || dependencies.now().toISOString(),
		};
		await dependencies.ensureDir(
			path.join(dependencies.campaignDir(slug), "sessions"),
		);
		await dependencies.writeJson(
			dependencies.campaignMetaPath(slug),
			newMeta,
		);

		for (const session of sessions) {
			const desiredName =
				session.fileName ||
				`${dependencies.sanitizeName(session.content?.name) || dependencies.todayString()}.json`;
			const fileName = await dependencies.ensureUniqueSessionFile(
				slug,
				desiredName,
			);
			await dependencies.writeJson(
				dependencies.sessionPath(slug, fileName),
				dependencies.replaceImageSlugReferences(
					session.content || {},
					sourceSlug,
					slug,
				),
			);
		}

		for (const type of ENTITY_TYPES) {
			for (const entity of Array.isArray(entities[type])
				? entities[type]
				: []) {
				const desiredSlug =
					entity.slug ||
					dependencies.campaignSlug(
						entity.firstName || entity.name || type,
					);
				const entitySlug =
					await dependencies.ensureUniqueEntitySlug(
						slug,
						type,
						desiredSlug,
					);
				const normalized =
					dependencies.replaceImageSlugReferences(
						entity,
						sourceSlug,
						slug,
					);
				await dependencies.writeEntity(slug, type, entitySlug, {
					...normalized,
					slug: entitySlug,
				});
			}
		}

		if (Array.isArray(aiResponses) && aiResponses.length > 0) {
			await dependencies.writeAiResponses(
				slug,
				aiResponses.map((entry) =>
					normalizeImportedAiResponse(entry, sourceSlug, slug),
				),
			);
		}
		return newMeta;
	}

	async function restoreCampaignImagesFromArchive(slug, files = []) {
		if (!Array.isArray(files) || files.length === 0) return;
		const root = path.join(
			dependencies.imagesDir,
			path.basename(String(slug || "")),
		);
		const resolvedRoot = path.resolve(root);
		for (const file of files) {
			const relativePath = String(file?.relativePath || "")
				.replace(/\\/g, "/")
				.replace(/^\/+/, "");
			if (!relativePath || !file?.base64) continue;
			const targetPath = path.resolve(root, relativePath);
			if (
				targetPath !== resolvedRoot &&
				!targetPath.startsWith(`${resolvedRoot}${path.sep}`)
			) {
				continue;
			}
			await dependencies.ensureDir(path.dirname(targetPath));
			await dependencies.writeFile(
				targetPath,
				Buffer.from(file.base64, "base64"),
			);
		}
	}

	async function importCampaignPartialArchiveBundle(
		targetSlug,
		archiveBundle,
	) {
		const target = path.basename(String(targetSlug || ""));
		if (
			!target ||
			!(await dependencies.exists(
				dependencies.campaignMetaPath(target),
			))
		) {
			throw new Error("Campaign for import was not found.");
		}
		const sections = normalizePartialArchiveSections(
			archiveBundle?.sections || [],
		);
		const bundle = archiveBundle?.bundle || {};
		const sourceMeta = bundle.meta || {};
		const sourceSlug =
			sourceMeta.slug || archiveBundle?.sourceSlug || target;
		const imported = {
			sessions: 0,
			npc: 0,
			locations: 0,
			images: 0,
			aiHistory: 0,
		};

		if (sections.includes("sessions")) {
			await dependencies.ensureDir(
				path.join(dependencies.campaignDir(target), "sessions"),
			);
			for (const session of Array.isArray(bundle.sessions)
				? bundle.sessions
				: []) {
				const fileName =
					await resolvePartialImportSessionFileName(
						target,
						session,
					);
				await dependencies.writeJson(
					dependencies.sessionPath(target, fileName),
					dependencies.replaceImageSlugReferences(
						session.content || {},
						sourceSlug,
						target,
					),
				);
				imported.sessions += 1;
			}
		}

		for (const type of ["npc", "locations"]) {
			if (!sections.includes(type)) continue;
			for (const entity of Array.isArray(bundle.entities?.[type])
				? bundle.entities[type]
				: []) {
				const entitySlug = importedEntitySlug(type, entity);
				const normalized =
					dependencies.replaceImageSlugReferences(
						entity,
						sourceSlug,
						target,
					);
				await dependencies.writeEntity(
					target,
					type,
					entitySlug,
					{ ...normalized, slug: entitySlug },
				);
				imported[type] += 1;
			}
		}

		if (sections.includes("aiHistory")) {
			const existing = await dependencies.readAiResponses(target);
			const incoming = (
				Array.isArray(bundle.aiResponses) ? bundle.aiResponses : []
			).map((entry) => ({
				...normalizeImportedAiResponse(
					entry,
					sourceSlug,
					target,
				),
				id: dependencies.createId(),
			}));
			if (incoming.length > 0) {
				await dependencies.writeAiResponses(target, [
					...existing,
					...incoming,
				]);
				imported.aiHistory = incoming.length;
			}
		}

		if (sections.includes("images")) {
			const images = Array.isArray(archiveBundle?.images)
				? archiveBundle.images
				: [];
			await restoreCampaignImagesFromArchive(target, images);
			imported.images = images.length;
		}
		return { ok: true, imported, sections };
	}

	async function importCampaignArchiveBundle(archiveBundle) {
		const importedMeta = await importCampaignBundle(
			archiveBundle.bundle || archiveBundle,
		);
		await restoreCampaignImagesFromArchive(
			importedMeta.slug,
			archiveBundle.images || [],
		);
		return importedMeta;
	}

	async function importCampaignArchiveBundleWithStrategy(
		archiveBundle,
		strategy = "append",
	) {
		if (strategy === "replace_by_id") {
			const bundle = archiveBundle.bundle || archiveBundle;
			const existingSlug = await findCampaignSlugById(bundle?.meta?.id);
			if (existingSlug) {
				const importedMeta = await importCampaignBundle(bundle, {
					forcedSlug: existingSlug,
					replaceExisting: true,
				});
				await restoreCampaignImagesFromArchive(
					importedMeta.slug,
					archiveBundle.images || [],
				);
				return importedMeta;
			}
		}
		return importCampaignArchiveBundle(archiveBundle);
	}

	return {
		clearAllCampaignData,
		findCampaignSlugById,
		importCampaignArchiveBundle,
		importCampaignArchiveBundleWithStrategy,
		importCampaignBundle,
		importCampaignPartialArchiveBundle,
		restoreCampaignImagesFromArchive,
	};
}

const archiveImportService = createArchiveImportService();

module.exports = {
	...archiveImportService,
	createArchiveImportService,
	replaceCampaignSlugFields,
};
