function sortByNameQuery(results, nameQuery) {
	if (!nameQuery) return;

	results.sort((a, b) => {
		const nA = a.name?.toLowerCase() || "";
		const nB = b.name?.toLowerCase() || "";

		if (nA === nameQuery && nB !== nameQuery) return -1;
		if (nB === nameQuery && nA !== nameQuery) return 1;

		const startsA = nA.startsWith(nameQuery);
		const startsB = nB.startsWith(nameQuery);
		if (startsA && !startsB) return -1;
		if (startsB && !startsA) return 1;

		if (nA.length !== nB.length) return nA.length - nB.length;
		return nA.localeCompare(nB);
	});
}

module.exports = {
	sortByNameQuery,
};
