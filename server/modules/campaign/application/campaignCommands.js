function fail(message, status) {
	const error = new Error(message);
	error.status = status;
	throw error;
}

function createCampaignCommands(
	repository,
	{ now = () => new Date(), createNoteId = () => Date.now() } = {},
) {
	return {
		list() {
			return repository.list();
		},

		async create({ payload = {} }) {
			const name = repository.sanitizeName(payload.name);
			if (!name) fail("Campaign name is required.", 400);
			const slug = await repository.ensureUniqueSlug(repository.toSlug(name));
			const campaign = {
				id: repository.createId(),
				slug,
				name,
				completed: false,
				completedAt: null,
				order: 0,
				createdAt: now().toISOString(),
				notes: [
					{ id: createNoteId(), title: "", text: "", collapsed: false },
				],
			};
			await repository.initialize(slug);
			return repository.write(slug, campaign);
		},

		async update({ slug, patch = {} }) {
			if (!(await repository.metaExists(slug))) {
				fail("Campaign not found.", 404);
			}
			const current = await repository.read(slug);
			const name = patch.name
				? repository.sanitizeName(patch.name)
				: current.name;
			if (!name) fail("Campaign name cannot be empty.", 400);
			const nextSlug = await repository.ensureUniqueSlug(
				repository.toSlug(name),
				slug,
			);
			if (nextSlug !== slug) await repository.rename(slug, nextSlug);
			let updated = {
				...current,
				...patch,
				id: current.id,
				createdAt: current.createdAt,
				slug: nextSlug,
				name,
			};
			updated = repository.replaceImageSlugReferences(updated, slug, nextSlug);
			if (Object.prototype.hasOwnProperty.call(patch, "ignoreSourcesList")) {
				updated.ignoreSourcesList = repository.normalizeSourceList(
					patch.ignoreSourcesList,
				);
			}
			return repository.write(nextSlug, updated);
		},

		async remove({ slug, moveImagesToGeneral = false }) {
			if (!(await repository.dataExists(slug))) {
				fail("Campaign not found.", 404);
			}
			await repository.remove(slug, { moveImagesToGeneral });
		},

		async getImageStatus({ slug }) {
			return { hasImages: await repository.hasImages(slug) };
		},

		export({ slug }) {
			return repository.exportBundle(slug);
		},

		async reorder({ orders }) {
			if (!orders || typeof orders !== "object" || Array.isArray(orders)) {
				fail("Campaign orders are required.", 400);
			}
			for (const [slug, order] of Object.entries(orders)) {
				if (!(await repository.metaExists(slug))) continue;
				const campaign = await repository.read(slug);
				await repository.write(slug, { ...campaign, order });
			}
			return { ok: true };
		},
	};
}

module.exports = { createCampaignCommands };
