function buildAiChangeSummary(resources = []) {
	return (Array.isArray(resources) ? resources : []).reduce(
		(summary, resource) => {
			if (resource.before === null && resource.after !== null) {
				summary.added += 1;
			} else if (resource.before !== null && resource.after === null) {
				summary.deleted += 1;
			} else {
				summary.modified += 1;
			}
			summary.total += 1;
			return summary;
		},
		{ added: 0, deleted: 0, modified: 0, total: 0 },
	);
}

module.exports = {
	buildAiChangeSummary,
};
