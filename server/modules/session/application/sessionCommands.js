function fail(message, status) {
	const error = new Error(message);
	error.status = status;
	throw error;
}

function createSessionCommands(repository, { now = () => new Date() } = {}) {
	async function requireSession(campaignSlug, fileName) {
		if (!(await repository.exists(campaignSlug, fileName))) {
			fail("Session not found.", 404);
		}
		return repository.read(campaignSlug, fileName);
	}

	return {
		list({ campaignSlug }) {
			return repository.list(campaignSlug);
		},

		async create({ campaignSlug, payload = {} }) {
			const sessions = await repository.list(campaignSlug);
			const maxOrder = sessions.reduce(
				(max, session) => Math.max(max, session.order || 0),
				-1,
			);
			const name =
				repository.sanitizeName(payload.name) ||
				now().toISOString().slice(0, 10);
			const session = repository.createDefault(name);
			session.order = maxOrder + 1;
			if (payload.data && typeof payload.data === "object") {
				session.data = payload.data;
			}
			const fileName = await repository.ensureUniqueFile(
				campaignSlug,
				session.name,
			);
			return repository.write(campaignSlug, fileName, session);
		},

		async get({ campaignSlug, fileName }) {
			const session = await requireSession(campaignSlug, fileName);
			return { ...session, fileName };
		},

		async update({ campaignSlug, fileName, patch = {} }) {
			const current = await requireSession(campaignSlug, fileName);
			const nextName = patch.name
				? repository.sanitizeName(patch.name)
				: current.name;
			if (!nextName) fail("Name cannot be empty.", 400);
			const nextFileName = await repository.ensureUniqueFile(
				campaignSlug,
				nextName,
				fileName,
			);
			const updated = {
				...current,
				...patch,
				name: nextName,
				id: current.id,
			};
			if (nextFileName !== fileName) {
				await repository.rename(campaignSlug, fileName, nextFileName);
			}
			return repository.write(campaignSlug, nextFileName, updated);
		},

		async remove({ campaignSlug, fileName }) {
			await requireSession(campaignSlug, fileName);
			await repository.remove(campaignSlug, fileName);
		},

		async reorder({ campaignSlug, orders }) {
			if (!orders || typeof orders !== "object" || Array.isArray(orders)) {
				fail("Session orders are required.", 400);
			}
			for (const [fileName, order] of Object.entries(orders)) {
				const session = await requireSession(campaignSlug, fileName);
				await repository.write(campaignSlug, fileName, { ...session, order });
			}
			return { ok: true };
		},
	};
}

module.exports = { createSessionCommands };
