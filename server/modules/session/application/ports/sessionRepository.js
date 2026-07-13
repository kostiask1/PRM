const REQUIRED_METHODS = Object.freeze([
	"exists",
	"list",
	"read",
	"write",
	"remove",
	"rename",
	"createId",
	"sanitizeName",
	"createDefault",
	"ensureUniqueFile",
]);

function createSessionRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Session repository requires ${method}().`);
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

module.exports = { createSessionRepositoryPort };
