const express = require("express");
const path = require("path");
const storage = require("../storage");

const router = express.Router();
const BESTIARY_TOKENS_DIR = path.join(storage.BESTIARY_DIR, "tokens");

router.use("/api/images", express.static(storage.IMAGES_DIR));
router.use("/api/bestiary/tokens", express.static(BESTIARY_TOKENS_DIR));
router.use("/assets/bestiary/tokens", express.static(BESTIARY_TOKENS_DIR));

module.exports = router;
