const REQUIRED_METHODS = Object.freeze([
	"readSpellAggregate",
	"readSpellIndex",
	"readSpellFile",
	"readReferenceFile",
]);

function createReferenceRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Reference repository requires ${method}().`);
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

module.exports = { createReferenceRepositoryPort };
