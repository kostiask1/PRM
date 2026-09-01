const REQUIRED_METHODS = Object.freeze([
	"list",
	"read",
	"write",
	"delete",
	"createId",
	"sanitizeName",
	"toSlug",
	"ensureUniqueSlug",
	"updateMentionReferences",
	"move",
]);

function createCampaignEntityRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Campaign entity repository requires ${method}().`);
		}
	}
	return Object.freeze(
		Object.fromEntries(
			REQUIRED_METHODS.map((method) => [
				method,
				implementation[method].bind(implementation),
			]),
		),
	);
}

module.exports = { createCampaignEntityRepositoryPort };
