const path = require("path");

function createStaticAssetDirectories(storage) {
	return Object.freeze({
		bestiaryTokens: path.join(storage.BESTIARY_DIR, "tokens"),
		images: storage.IMAGES_DIR,
	});
}

module.exports = { createStaticAssetDirectories };
