const { coerceAiText: asText } = require("../../ai/textUtils");

function operationPatch(operation) {
	if (operation.patch && typeof operation.patch === "object") {
		return operation.patch;
	}
	if (operation.data && typeof operation.data === "object") {
		return operation.data;
	}
	return {};
}

function applyCampaignOperation(state, operation) {
	const op = asText(operation.op).toLowerCase();
	if (op !== "update") return null;
	const patch = operationPatch(operation);
	if (!Object.prototype.hasOwnProperty.call(patch, "description")) {
		return null;
	}
	state.campaignMeta.description = asText(patch.description);
	return { type: "campaign", saved: state.campaignMeta };
}

module.exports = {
	applyCampaignOperation,
};
