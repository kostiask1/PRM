const express = require("express");
const {
	BESTIARY_TOKENS_DIR,
	IMAGES_DIR,
} = require("../infrastructure/storagePaths");

const router = express.Router();
const STATIC_REFERENCE_ASSET_OPTIONS = {
	maxAge: "30d",
	immutable: true,
};

router.use("/api/images", express.static(IMAGES_DIR));
router.use(
	"/api/bestiary/tokens",
	express.static(BESTIARY_TOKENS_DIR, STATIC_REFERENCE_ASSET_OPTIONS),
);
router.use(
	"/assets/bestiary/tokens",
	express.static(BESTIARY_TOKENS_DIR, STATIC_REFERENCE_ASSET_OPTIONS),
);

module.exports = router;
