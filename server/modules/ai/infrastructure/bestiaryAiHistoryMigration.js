function createBestiaryAiHistoryMigration({
	aiResponsesPath,
	campaignAiResponsesPath,
	exists,
	normalizeResponses,
	readJson,
	writeJson,
}) {
	const migrationPromises = new Map();

	async function migrateLegacyBestiaryResponses(slug) {
		const responsesPath = aiResponsesPath(slug);
		if (slug !== "bestiary" || (await exists(responsesPath))) {
			return { responsesPath };
		}

		const legacyResponsesPath = campaignAiResponsesPath(slug);
		if (!(await exists(legacyResponsesPath))) {
			return { responsesPath };
		}

		let responses;
		try {
			responses = normalizeResponses(await readJson(legacyResponsesPath));
		} catch {
			return { responsesPath };
		}

		try {
			await writeJson(responsesPath, responses);
		} catch {
			// Keep the normalized in-memory history available. A later call
			// retries because the canonical path still does not exist.
		}
		return { responses, responsesPath };
	}

	async function ensureCanonicalAiResponses(slug) {
		const migrationKey = String(slug);
		const pendingMigration = migrationPromises.get(migrationKey);
		if (pendingMigration) return pendingMigration;

		const migration = migrateLegacyBestiaryResponses(slug);
		migrationPromises.set(migrationKey, migration);
		try {
			return await migration;
		} finally {
			if (migrationPromises.get(migrationKey) === migration) {
				migrationPromises.delete(migrationKey);
			}
		}
	}

	async function writeCanonicalAiResponses(slug, responses) {
		const migrationKey = String(slug);
		const previousOperation = ensureCanonicalAiResponses(slug);
		const responsesPath = aiResponsesPath(slug);
		const writeOperation = (async () => {
			try {
				await previousOperation;
			} catch {
				// A live write remains eligible after a failed earlier
				// migration/write availability check.
			}
			await writeJson(responsesPath, responses);
			return { responsesPath };
		})();
		const operationBarrier = writeOperation.then(
			() => ({ responsesPath }),
			() => ({ responsesPath }),
		);
		migrationPromises.set(migrationKey, operationBarrier);
		try {
			return await writeOperation;
		} finally {
			if (
				migrationPromises.get(migrationKey) ===
				operationBarrier
			) {
				migrationPromises.delete(migrationKey);
			}
		}
	}

	return {
		ensureCanonicalAiResponses,
		writeCanonicalAiResponses,
	};
}

module.exports = { createBestiaryAiHistoryMigration };
