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
} = require("../../infrastructure/storagePaths");
const {
	listSessions,
} = require("../session/sessionRepository");

function createCampaignRepository(overrides = {}) {
	const dependencies = {
		campaignDir,
		campaignMetaPath,
		campaignSlug,
		campaignsDir: CAMPAIGNS_DIR,
		createId: () => crypto.randomUUID(),
		ensureDir,
		exists,
		imagesDir: IMAGES_DIR,
		listSessions,
		now: () => new Date(),
		readDir: fs.readdir,
		readJson,
		sanitizeName,
		stat: fs.stat,
		writeJson,
		...overrides,
	};

	async function listCampaignSlugs() {
		const entries = await dependencies.readDir(dependencies.campaignsDir, {
			withFileTypes: true,
		});
		const slugs = [];
		for (const entry of entries) {
			if (entry.isDirectory()) {
				slugs.push(entry.name);
			} else if (entry.isSymbolicLink()) {
				const stats = await dependencies
					.stat(path.join(dependencies.campaignsDir, entry.name))
					.catch(() => null);
				if (stats?.isDirectory()) slugs.push(entry.name);
			}
		}
		return slugs;
	}

	async function readCampaign(slug) {
		return dependencies.readJson(dependencies.campaignMetaPath(slug));
	}

	async function writeCampaign(slug, campaign) {
		await dependencies.writeJson(
			dependencies.campaignMetaPath(slug),
			campaign,
		);
		return campaign;
	}

	async function campaignExists(slug) {
		return dependencies.exists(dependencies.campaignMetaPath(slug));
	}

	async function ensureUniqueCampaignSlug(baseSlug, ignoreSlug = null) {
		let slug = baseSlug;
		let counter = 2;
		while (true) {
			const campaignPath = dependencies.campaignDir(slug);
			const imagePath = path.join(
				dependencies.imagesDir,
				path.basename(slug),
			);
			const taken =
				(await dependencies.exists(campaignPath)) ||
				(await dependencies.exists(imagePath));
			if (!taken || slug === ignoreSlug) return slug;
			slug = `${baseSlug}-${counter}`;
			counter += 1;
		}
	}

	async function createCampaign(input = {}) {
		const name = dependencies.sanitizeName(input.name);
		if (!name) return null;
		const slug = await ensureUniqueCampaignSlug(
			dependencies.campaignSlug(name),
		);
		const now = dependencies.now();
		const meta = {
			id: dependencies.createId(),
			slug,
			name,
			completed: false,
			completedAt: null,
			order: 0,
			createdAt: now.toISOString(),
			notes: [
				{
					id: now.getTime(),
					title: "",
					text: "",
					collapsed: false,
				},
			],
		};
		await dependencies.ensureDir(
			path.join(dependencies.campaignDir(slug), "sessions"),
		);
		await writeCampaign(slug, meta);
		return meta;
	}

	async function listCampaignsDetailed() {
		const campaigns = await Promise.all(
			(await listCampaignSlugs()).map(async (slug) => {
				try {
					const meta = await readCampaign(slug);
					const sessions = await dependencies.listSessions(slug);
					return { ...meta, slug, sessionCount: sessions.length };
				} catch {
					return null;
				}
			}),
		);
		return campaigns
			.filter(Boolean)
			.sort(
				(a, b) =>
					(a.order || 0) - (b.order || 0) ||
					a.name.localeCompare(b.name),
			);
	}

	async function reorderCampaigns(orders = {}) {
		for (const [slug, order] of Object.entries(orders)) {
			if (!(await campaignExists(slug))) continue;
			const meta = await readCampaign(slug);
			meta.order = order;
			await writeCampaign(slug, meta);
		}
	}

	return {
		campaignExists,
		createCampaign,
		ensureUniqueCampaignSlug,
		listCampaignSlugs,
		listCampaignsDetailed,
		readCampaign,
		reorderCampaigns,
		writeCampaign,
	};
}

const campaignRepository = createCampaignRepository();

module.exports = {
	...campaignRepository,
	createCampaignRepository,
};
