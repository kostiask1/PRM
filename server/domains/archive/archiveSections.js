const PARTIAL_ARCHIVE_SECTIONS = Object.freeze([
	"sessions",
	"npc",
	"locations",
	"images",
	"aiHistory",
]);

function normalizePartialArchiveSections(sections = []) {
	const allowed = new Set(PARTIAL_ARCHIVE_SECTIONS);
	const selected = (
		Array.isArray(sections) ? sections : String(sections).split(",")
	)
		.map((section) => String(section || "").trim())
		.filter((section) => allowed.has(section));
	return [...new Set(selected)];
}

module.exports = {
	PARTIAL_ARCHIVE_SECTIONS,
	normalizePartialArchiveSections,
};
