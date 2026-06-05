const { coerceAiText: asText } = require("./textUtils");

function getCharacterDisplayName(entity = {}) {
	const firstName = asText(entity.firstName || entity.first_name);
	const lastName = asText(entity.lastName || entity.last_name);
	const combined = `${firstName} ${lastName}`.trim();
	if (combined) return combined;
	return asText(entity.name || entity.title);
}

function getLocationDisplayName(entity = {}) {
	return asText(entity.name || entity.title);
}

module.exports = {
	getCharacterDisplayName,
	getLocationDisplayName,
};
