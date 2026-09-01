const REQUIRED_METHODS = Object.freeze([
	"metaExists",
	"dataExists",
	"list",
	"read",
	"write",
	"initialize",
	"rename",
	"remove",
	"hasImages",
	"exportBundle",
	"sanitizeName",
	"toSlug",
	"ensureUniqueSlug",
	"createId",
	"replaceImageSlugReferences",
	"normalizeSourceList",
]);

function createCampaignRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Campaign repository requires ${method}().`);
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

module.exports = { createCampaignRepositoryPort };
