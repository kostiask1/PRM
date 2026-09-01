const express = require("express");
const storage = require("../storage");
const {
	createStaticAssetDirectories,
} = require("../modules/assets/infrastructure/staticAssetDirectories");

const router = express.Router();
const assetDirectories = createStaticAssetDirectories(storage);
const STATIC_REFERENCE_ASSET_OPTIONS = {
	maxAge: "30d",
	immutable: true,
};

router.use("/api/images", express.static(assetDirectories.images));
router.use(
	"/api/bestiary/tokens",
	express.static(assetDirectories.bestiaryTokens, STATIC_REFERENCE_ASSET_OPTIONS),
);
router.use(
	"/assets/bestiary/tokens",
	express.static(assetDirectories.bestiaryTokens, STATIC_REFERENCE_ASSET_OPTIONS),
);

module.exports = router;
