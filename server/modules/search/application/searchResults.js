function getLoweredSearchResultName(item) {
	return item.name?.toLowerCase() || "";
}

function getExclusiveSearchPriority(leftMatches, rightMatches) {
	if (leftMatches === rightMatches) return 0;
	return leftMatches ? -1 : 1;
}

function getExactSearchPriority(leftName, rightName, nameQuery) {
	return getExclusiveSearchPriority(
		leftName === nameQuery,
		rightName === nameQuery,
	);
}

function getPrefixSearchPriority(leftName, rightName, nameQuery) {
	return getExclusiveSearchPriority(
		leftName.startsWith(nameQuery),
		rightName.startsWith(nameQuery),
	);
}

function getSearchLengthPriority(leftName, rightName) {
	if (leftName.length === rightName.length) return 0;
	return leftName.length - rightName.length;
}

function compareNameQueryResults(left, right, nameQuery) {
	const leftName = getLoweredSearchResultName(left);
	const rightName = getLoweredSearchResultName(right);
	const exactPriority = getExactSearchPriority(leftName, rightName, nameQuery);
	if (exactPriority) return exactPriority;
	const prefixPriority = getPrefixSearchPriority(leftName, rightName, nameQuery);
	if (prefixPriority) return prefixPriority;
	const lengthPriority = getSearchLengthPriority(leftName, rightName);
	if (lengthPriority) return lengthPriority;
	return leftName.localeCompare(rightName);
}

function createNameQueryComparator(nameQuery) {
	return (left, right) => compareNameQueryResults(left, right, nameQuery);
}

function sortByNameQuery(results, nameQuery) {
	if (!nameQuery) return;
	results.sort(createNameQueryComparator(nameQuery));
}

module.exports = {
	sortByNameQuery,
};
