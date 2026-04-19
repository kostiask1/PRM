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
			generateEncounters,
			contextConfig,
		} = req.body;
		if (!process.env.GEMINI_API_KEY)
			return res.status(500).json({ error: "GEMINI_API_KEY не налаштовано." });

		const campaign = await storage.readCampaign(path.campaign);
		let session = await storage
			.readSession(path.campaign, path.session)
			.catch(() => null);

		let contextData = { campaign: {}, sessions: [] };
		if (contextConfig) {
			if (contextConfig.campaignNotes) contextData.campaign.notes = campaign.notes;
			if (contextConfig.campaignCharacters) {
				// Збираємо і персонажів, і NPC в один масив персонажів для контексту сюжету
				const chars = await storage.listEntities(path.campaign, "characters");
				const npcs = await storage.listEntities(path.campaign, "npc");
				contextData.campaign.characters = [...chars, ...npcs];
			}

			if (contextConfig.sessions) {
				for (const [slug, conf] of Object.entries(contextConfig.sessions)) {
					if (conf.included) {
						const sData = await storage.readSession(path.campaign, slug);
						contextData.sessions.push({
							name: sData.name,
							conf,
							data: sData.data,
						});
					}
				}
			}
		}

		const generatedContent = await aiService.generateContent({
			type,
			session,
			campaign,
			userInstructions,
			sceneId,
			parseAIResponse,
			contextData,
			generateEncounters,
		});

		if (generatedContent.error) return res.status(500).json(generatedContent);
		if (!parseAIResponse) return res.json({ prompt: generatedContent });

		let updatedObject = null;
		if (campaign) {
			if (session) {
				const fullPath = storage.sessionPath(path.campaign, path.session);
				const sessionData = await storage.readJson(fullPath);

				// 1. Обробка згенерованих боїв (Encounters)
				const encounterMap = new Map(); // Тимчасова мапа для зв'язку індексів AI з новими ID
				if (Array.isArray(generatedContent.encounters)) {
					if (!sessionData.data.encounters) sessionData.data.encounters = [];

					generatedContent.encounters.forEach((enc, idx) => {
						const newId = storage.createId();
						const newEncounter = {
							id: newId,
							name: enc.name || `Бій ${sessionData.data.encounters.length + 1}`,
							monsters: (enc.monsters || []).map(m => ({
								...m,
								instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
								name: m.name || m.monsterName,
								currentHp: 0, // Буде заповнено при відкритті
								hit_points: 0,
								armor_class: 0
							}))
						};
						sessionData.data.encounters.push(newEncounter);
						encounterMap.set(idx, newId);
					});
				}

				// 2. Обробка сцен
				if (generatedContent.scenes) {
					sessionData.data.scenes = generatedContent.scenes.map((s, idx) => {
						const existing = sessionData.data?.scenes?.[idx] || {};
						
						// Визначаємо ID зіткнення:
						// Пріоритет 1: Нове згенероване зіткнення по індексу
						// Пріоритет 2: Існуюче зіткнення в сцені
						let encounterId = existing?.encounterId || "";
						if (s.encounterIndex !== undefined && encounterMap.has(s.encounterIndex)) {
							encounterId = encounterMap.get(s.encounterIndex);
						}

						return {
							id:
								existing?.id || Date.now() + Math.floor(Math.random() * 100000),
							texts: s.texts,
							npcs: s.npcs,
							collapsed: existing?.collapsed || false,
							encounterId: encounterId,
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
					for (const c of generatedContent.characters) {
						const name = c.firstName || c.name;
						const charSlug = storage.campaignSlug(name);
						await storage.writeEntity(path.campaign, "characters", charSlug, {
							id: storage.createId(),
							...c,
							collapsed: false
						});
					}
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
