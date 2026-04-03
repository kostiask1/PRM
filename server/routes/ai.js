const express = require("express");
const router = express.Router();
const storage = require("../storage");
const aiService = require("../aiService");

router.post("/generate", async (req, res, next) => {
	try {
		const {
			type,
			userInstructions,
			path,
			sceneId,
			parseAIResponse,
			useSessionsResults,
			useContext,
		} = req.body;
		if (!process.env.GEMINI_API_KEY)
			return res.status(500).json({ error: "GEMINI_API_KEY не налаштовано." });

		const campaign = await storage.readCampaign(path.campaign);
		const session = await storage
			.readSession(path.campaign, path.session)
			.catch(() => null);

		let results = [];
		if (useSessionsResults) {
			const sessionFiles = await storage.listSessions(path.campaign);
			const sessions = await Promise.all(
				sessionFiles.map((s) => storage.readSession(path.campaign, s.fileName)),
			);
			results = sessions
				.sort((a, b) => a.order - b.order)
				.map((s) => ({ result: s.data.result_text, session: s.name }));
		}

		const generatedContent = await aiService.generateContent({
			type,
			session,
			campaign,
			userInstructions,
			sceneId,
			parseAIResponse,
			results,
			useContext,
		});

		if (generatedContent.error) return res.status(500).json(generatedContent);
		if (!parseAIResponse) return res.json({ prompt: generatedContent });

		let updatedObject = null;
		if (campaign) {
			if (session) {
				const fullPath = storage.sessionPath(path.campaign, path.session);
				const sessionData = await storage.readJson(fullPath);
				if (generatedContent.scenes) {
					sessionData.data.scenes = generatedContent.scenes.map((s, idx) => {
						const existing = sessionData.data?.scenes?.[idx] || {};
						return {
							id:
								existing?.id || Date.now() + Math.floor(Math.random() * 100000),
							texts: s.texts,
							npcs: s.npcs,
							collapsed: existing?.collapsed || false,
							encounterId: existing?.encounterId || "",
						};
					});
				}
				sessionData.updatedAt = new Date().toISOString();
				await storage.writeJson(fullPath, sessionData);
				updatedObject = { ...sessionData, fileName: path.session };
			} else {
				const metaPath = storage.campaignMetaPath(path.campaign);
				const meta = await storage.readJson(metaPath);
				if (generatedContent.description)
					meta.description = generatedContent.description;
				if (Array.isArray(generatedContent.notes)) {
					meta.notes = generatedContent.notes.map((text) => ({
						id: Date.now() + Math.floor(Math.random() * 100000),
						text,
						collapsed: false,
					}));
				}
				if (Array.isArray(generatedContent.characters)) {
					meta.characters = generatedContent.characters.map((c) => ({
						id: Date.now() + Math.floor(Math.random() * 100000),
						name: c.name,
						description: c.description,
						collapsed: false,
					}));
				}
				meta.updatedAt = new Date().toISOString();
				await storage.writeJson(metaPath, meta);
				updatedObject = meta;
			}
		}

		res.json({ generated: generatedContent, updated: updatedObject });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
