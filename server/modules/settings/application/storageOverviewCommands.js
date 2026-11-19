const AI_HISTORY_CLEAR_SCOPES = Object.freeze(["all", "bestiary", "campaign"]);

function createStorageOverviewCommands(repository) {
	return {
		getOverview() {
			return repository.readStorageOverview();
		},
		async clearAiHistory({ scope, campaignSlug } = {}) {
			const normalizedScope = String(scope || "").trim();
			if (!AI_HISTORY_CLEAR_SCOPES.includes(normalizedScope)) {
				const error = new Error("Invalid AI history cleanup scope.");
				error.status = 400;
				throw error;
			}

			let normalizedSlug = null;
			if (normalizedScope === "campaign") {
				normalizedSlug = String(campaignSlug || "").trim();
				if (!normalizedSlug || normalizedSlug === "bestiary") {
					const error = new Error("Campaign is required.");
					error.status = 400;
					throw error;
				}
				if (!(await repository.campaignExists(normalizedSlug))) {
					const error = new Error("Campaign not found.");
					error.status = 404;
					throw error;
				}
				await repository.clearCampaignAiHistory(normalizedSlug);
			} else if (normalizedScope === "bestiary") {
				await repository.clearBestiaryAiHistory();
			} else {
				await repository.clearAllAiHistory();
			}

			return {
				cleared: true,
				scope: normalizedScope,
				campaignSlug: normalizedSlug,
				storage: await repository.readStorageOverview(),
			};
		},
	};
}

module.exports = {
	AI_HISTORY_CLEAR_SCOPES,
	createStorageOverviewCommands,
};
