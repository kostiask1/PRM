const REQUIRED_METHODS = Object.freeze([
	"getIndex",
	"readCustomMonsters",
	"writeCustomMonsters",
	"readFavorites",
	"writeFavorites",
	"readAllMonsters",
	"listSourceFiles",
	"readLegendaryGroups",
	"readSourceMonsters",
]);

function createBestiaryRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Bestiary repository requires ${method}().`);
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

module.exports = { createBestiaryRepositoryPort };
