const REQUIRED_METHODS = Object.freeze([
	"readEntity",
	"writeEntity",
	"deleteEntity",
	"readSession",
	"writeSession",
	"sanitizeName",
	"toSlug",
	"ensureUniqueSlug",
]);

function createCampaignEntityScopeRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Campaign entity scope repository requires ${method}().`);
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

module.exports = { createCampaignEntityScopeRepositoryPort };
