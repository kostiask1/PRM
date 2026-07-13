const REQUIRED_METHODS = Object.freeze([
	"ensureUploadDirectory",
	"resolveUploadFileName",
	"list",
	"stats",
	"listBestiaryTokens",
	"search",
	"listSubcategories",
	"createSubcategory",
	"renameImage",
	"renameSubcategory",
	"move",
	"delete",
]);

function createImageRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Image repository requires ${method}().`);
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

module.exports = { createImageRepositoryPort };
