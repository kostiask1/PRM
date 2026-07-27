const NOTE_OPERATIONS = new Set([
	"appendnote",
	"updatenote",
	"deletenote",
]);

async function dispatchAiOperations({
	operations,
	state,
	normalizerOptions,
	text,
	isCustomMonsterOperation,
	entityTypeFromOperation,
	operationScope,
	applyNoteOperation,
	applyCampaignOperation,
	applySceneOperation,
	applyEncounterOperation,
	applyEntityOperation,
}) {
	let hasAppliedChanges = false;
	let campaignMetaChanged = false;
	let sessionDataChanged = false;

	for (const operation of operations) {
		if (!operation || typeof operation !== "object") continue;

		const op = text(operation.op).toLowerCase();
		const entity = text(operation.entity).toLowerCase();
		if (isCustomMonsterOperation(operation)) continue;

		if (NOTE_OPERATIONS.has(op)) {
			const result = await applyNoteOperation(
				state,
				operation,
				normalizerOptions,
			);
			if (result) {
				hasAppliedChanges = true;
				const type = entityTypeFromOperation(entity);
				const scope = type
					? operationScope(
							operation,
							type === "characters"
								? "campaign"
								: state.defaultEntityScope,
							state.clientIdMap,
						)
					: "";
				if (entity === "campaign") {
					campaignMetaChanged = true;
				} else if (
					entity === "session" ||
					entity === "scene" ||
					entity === "scenes" ||
					scope === "session"
				) {
					sessionDataChanged = true;
				}
			}
			continue;
		}

		if (entity === "campaign") {
			const result = applyCampaignOperation(state, operation);
			if (result) {
				hasAppliedChanges = true;
				campaignMetaChanged = true;
			}
			continue;
		}

		if (entity === "scene" || entity === "scenes") {
			const result = applySceneOperation(
				state,
				operation,
				normalizerOptions,
			);
			if (result) {
				hasAppliedChanges = true;
				sessionDataChanged = true;
			}
			continue;
		}

		if (entity === "encounter" || entity === "encounters") {
			const result = await applyEncounterOperation(state, operation);
			if (result) {
				hasAppliedChanges = true;
				sessionDataChanged = true;
			}
			continue;
		}

		if (entityTypeFromOperation(entity)) {
			const result = await applyEntityOperation(
				state,
				operation,
				normalizerOptions,
			);
			if (result) {
				hasAppliedChanges = true;
				if (
					result.scope === "session" ||
					result.moved ||
					result.sessionChanged
				) {
					sessionDataChanged = true;
				}
			}
		}
	}

	return {
		hasAppliedChanges,
		campaignMetaChanged,
		sessionDataChanged,
	};
}

module.exports = {
	dispatchAiOperations,
};
