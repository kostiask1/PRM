const zlib = require("zlib");

function parseList(value) {
	return String(value || "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function normalizeImportStrategy(strategy) {
	const value = String(strategy || "append").toLowerCase();
	return ["append", "replace_by_id", "wipe_and_replace"].includes(value)
		? value
		: "append";
}

function parseArchivePayload(buffer) {
	if (!buffer) {
		const error = new Error("Archive file was not provided.");
		error.status = 400;
		throw error;
	}
	const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
	const raw = isGzip ? zlib.gunzipSync(buffer) : buffer;
	return JSON.parse(raw.toString("utf8"));
}

function buildArchivePayload(scope, campaigns, exportedAt, applicationData) {
	return {
		version: 3,
		scope,
		exportedAt: exportedAt.toISOString(),
		campaigns,
		...(applicationData === undefined ? {} : { applicationData }),
	};
}

function createDownload(payload, filename) {
	return {
		buffer: zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8")),
		contentType: "application/gzip",
		filename,
	};
}

function createBackupCommands(repository, { now = () => new Date() } = {}) {
	const date = () => now().toISOString().slice(0, 10);

	async function importBundles(bundles, strategy) {
		if (strategy === "wipe_and_replace") await repository.clearAllCampaignData();
		for (const bundle of bundles) {
			if (strategy === "replace_by_id") {
				const existingSlug = await repository.findCampaignSlugById(bundle?.meta?.id);
				if (existingSlug) {
					await repository.importCampaignBundle(bundle, {
						forcedSlug: existingSlug,
						replaceExisting: true,
					});
					continue;
				}
			}
			await repository.importCampaignBundle(bundle);
		}
	}

	return {
		async exportAll() {
			const slugs = await repository.listCampaignSlugs();
			return Promise.all(slugs.map(repository.exportCampaignBundle));
		},
		async exportAllArchive() {
			const slugs = await repository.listCampaignSlugs();
			const [campaigns, applicationData] = await Promise.all([
				Promise.all(slugs.map(repository.exportCampaignArchiveBundle)),
				repository.exportApplicationDataArchiveBundle(slugs),
			]);
			return createDownload(
				buildArchivePayload("all", campaigns, now(), applicationData),
				`prm-full-backup-${date()}.prma.gz`,
			);
		},
		async exportCampaignArchive({ slug }) {
			const campaign = await repository.exportCampaignArchiveBundle(slug);
			return createDownload(
				buildArchivePayload("campaign", [campaign], now()),
				`campaign-${slug}-${date()}.prma.gz`,
			);
		},
		async exportPartialArchive({ slug, sections }) {
			return createDownload(
				await repository.exportCampaignPartialArchiveBundle(
					slug,
					parseList(sections),
				),
				`campaign-${slug}-partial-${date()}.prma.gz`,
			);
		},
		async importPartialArchive({ slug, buffer, sections, payload }) {
			const parsed =
				payload === undefined
					? parseArchivePayload(buffer)
					: payload;
			const bundle = Array.isArray(parsed?.campaigns) ? parsed.campaigns[0] : parsed;
			const selected = parseList(sections);
			return repository.importCampaignPartialArchiveBundle(
				slug,
				selected.length ? { ...bundle, sections: selected } : bundle,
			);
		},
		async importAll({ payload, strategy: rawStrategy }) {
			const strategy = normalizeImportStrategy(rawStrategy);
			const bundles = Array.isArray(payload) ? payload : [payload];
			await importBundles(bundles, strategy);
			return { ok: true, imported: bundles.length, strategy };
		},
		async importArchive({
			buffer,
			payload,
			mode: rawMode,
			strategy: rawStrategy,
		}) {
			const mode = rawMode === "campaign" ? "campaign" : "all";
			const strategy =
				mode === "all" ? normalizeImportStrategy(rawStrategy) : "append";
			const parsed =
				payload === undefined
					? parseArchivePayload(buffer)
					: payload;
			const campaigns = Array.isArray(parsed)
				? parsed
				: Array.isArray(parsed?.campaigns)
					? parsed.campaigns
					: [parsed];
			const selected = mode === "campaign" ? campaigns.slice(0, 1) : campaigns;
			if (strategy === "wipe_and_replace") await repository.clearAllCampaignData();
			for (const bundle of selected) {
				await repository.importCampaignArchiveBundleWithStrategy(bundle, strategy);
			}
			if (mode === "all" && parsed?.applicationData) {
				await repository.importApplicationDataArchiveBundle(
					parsed.applicationData,
				);
			}
			return { ok: true, imported: selected.length, strategy };
		},
	};
}

module.exports = {
	createBackupCommands,
	createDownload,
	normalizeImportStrategy,
	parseArchivePayload,
	parseList,
};
