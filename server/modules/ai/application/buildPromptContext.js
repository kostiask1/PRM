function noteToPromptContext(note, { includeTitle = true } = {}) {
	if (!note) return null;
	if (typeof note === "string") {
		return note.trim() ? { text: note } : null;
	}
	if (typeof note !== "object" || note._aiIgnored) return null;
	const title = includeTitle ? String(note.title || "").trim() : "";
	const text = String(note.text || "");
	if (!title && !text.trim()) return null;
	return {
		id: note.id,
		...(includeTitle ? { title } : {}),
		text,
	};
}

const isAiIgnored = (value = {}) => Boolean(value?._aiIgnored);

function entityContextName(entity = {}) {
	return (
		`${entity.firstName || entity.first_name || ""} ${
			entity.lastName || entity.last_name || ""
		}`.trim() ||
		entity.name ||
		entity.title
	);
}

function characterToPromptContext(entity = {}, noteToContextNote) {
	if (isAiIgnored(entity)) return null;
	return {
		id: entity.id,
		slug: entity.slug,
		name: entityContextName(entity),
		race: entity.race,
		class: entity.class,
		level: entity.level,
		motivation: entity.motivation,
		description: entity.description,
		trait: entity.trait,
		notes: (entity.notes || []).map(noteToContextNote).filter(Boolean),
	};
}

function npcToPromptContext(entity = {}, noteToContextNote) {
	if (isAiIgnored(entity)) return null;
	return {
		id: entity.id,
		slug: entity.slug,
		name: entityContextName(entity),
		race: entity.race,
		class: entity.class,
		level: entity.level,
		description: entity.description,
		motivation: entity.motivation,
		trait: entity.trait,
		notes: (entity.notes || []).map(noteToContextNote).filter(Boolean),
	};
}

function locationToPromptContext(location = {}, noteToContextNote) {
	if (isAiIgnored(location)) return null;
	return {
		id: location.id,
		slug: location.slug,
		name: location.name || location.title,
		description: location.description,
		notes: (location.notes || []).map(noteToContextNote).filter(Boolean),
	};
}

function buildSelectedSessions(sessions, noteToContextNote) {
	return (sessions || [])
		.map((session) => {
			const result = {
				id: session.slug,
				slug: session.slug,
				name: session.name,
			};
			const config = session.conf || {};
			const data = session.data || {};
			if (config.included && config.notes && data.notes) {
				result.notes = data.notes.map(noteToContextNote).filter(Boolean);
			}
			if (config.included && config.result_text && data.result_text) {
				result.result = data.result_text;
			}
			if (config.included && data.scenes) {
				const hasConfig =
					config.scenes &&
					typeof config.scenes === "object" &&
					Object.keys(config.scenes).length > 0;
				const defaults = {
					included: true,
					summary: true,
					goal: true,
					stakes: true,
					location: true,
					notes: true,
					encounter: true,
				};
				const fields = ["summary", "goal", "stakes", "location"];
				const scenes = data.scenes
					.filter((scene) => !hasConfig || config.scenes[scene.id]?.included)
					.map((scene) => {
						const sceneConfig = hasConfig
							? { ...defaults, ...(config.scenes[scene.id] || {}) }
							: defaults;
						const sceneResult = { id: scene.id };
						if (sceneConfig.encounter && scene.encounterId) {
							const encounter = (data.encounters || []).find(
								(item) => String(item.id) === String(scene.encounterId),
							);
							if (encounter?.monsters) {
								sceneResult.monsters = encounter.monsters.map(
									(monster) => monster.name || monster.monsterName,
								);
							}
						}
						if (sceneConfig.notes) {
							sceneResult.notes = (scene.notes || [])
								.map(noteToContextNote)
								.filter(Boolean);
						}
						for (const field of fields) {
							if (!sceneConfig[field]) continue;
							const value = scene.texts?.[field];
							if (value !== undefined && value !== null) {
								sceneResult[field] = value;
							}
						}
						return sceneResult;
					});
				if (scenes.length > 0) result.scenes = scenes;
			}
			if (config.included && Array.isArray(data.npcs) && data.npcs.length > 0) {
				result.npcs = data.npcs
					.map((npc) => npcToPromptContext(npc, noteToContextNote))
					.filter((npc) => npc && (npc.name || npc.description || npc.motivation));
			}
			if (
				config.included &&
				Array.isArray(data.locations) &&
				data.locations.length > 0
			) {
				result.locations = data.locations
					.map((location) => locationToPromptContext(location, noteToContextNote))
					.filter((location) => location && (location.name || location.description));
			}
			return result;
		})
		.filter((session) =>
			Boolean(
				session.notes ||
					session.result ||
					session.scenes ||
					session.npcs ||
					session.locations,
			),
		);
}

function buildCurrentSession(session, contextData, noteToContextNote) {
	const data =
		contextData?.currentSession?.data &&
		typeof contextData.currentSession.data === "object"
			? contextData.currentSession.data
			: session.data || {};
	const result = {
		id: session.id,
		slug: contextData?.currentSession?.slug,
		fileName: contextData?.currentSession?.fileName,
		name: contextData?.currentSession?.name || session.name,
	};
	if (Array.isArray(data.scenes) && data.scenes.length > 0) {
		result.scenes = data.scenes.map((scene) => ({
			id: scene.id,
			texts: scene.texts,
			encounterId: scene.encounterId || "",
			notes: (scene.notes || []).map(noteToContextNote).filter(Boolean),
			npcs: scene.npcs || [],
		}));
	}
	if (Array.isArray(data.encounters) && data.encounters.length > 0) {
		result.encounters = data.encounters.map((encounter) => ({
			id: encounter.id,
			name: encounter.name,
			monsters: (encounter.monsters || []).map((monster) => ({
				name: monster.name,
				monsterName: monster.originalBestiaryName || monster.name,
				cr: monster.cr || monster.challenge_rating,
			})),
		}));
	}
	if (Array.isArray(data.npcs) && data.npcs.length > 0) {
		result.npcs = data.npcs
			.map((npc) => npcToPromptContext(npc, noteToContextNote))
			.filter((npc) => npc && (npc.name || npc.description || npc.motivation || npc.trait));
	}
	if (Array.isArray(data.locations) && data.locations.length > 0) {
		result.locations = data.locations
			.map((location) => locationToPromptContext(location, noteToContextNote))
			.filter((location) => location && (location.name || location.description));
	}
	return result;
}

function buildPromptContext({
	campaign,
	session,
	contextData,
	entityTargetScope,
	encounterId,
	simplifiedNotesEnabled = false,
}) {
	const noteToContextNote = (note) =>
		noteToPromptContext(note, { includeTitle: !simplifiedNotesEnabled });
	const result = {};
	if (campaign) {
		result.campaign = {
			name: campaign.name,
			description: campaign.description,
			notes: contextData?.campaign?.notes?.map(noteToContextNote).filter(Boolean),
			characters: contextData?.campaign?.characters
				?.map((character) => characterToPromptContext(character, noteToContextNote))
				.filter((character) => character && (character.name || character.description || character.motivation || character.trait)),
			npcs: contextData?.campaign?.npcs
				?.map((npc) => npcToPromptContext(npc, noteToContextNote))
				.filter((npc) => npc && (npc.name || npc.description || npc.motivation || npc.trait)),
			locations: contextData?.campaign?.locations
				?.map((location) => locationToPromptContext(location, noteToContextNote))
				.filter((location) => location && (location.name || location.description)),
		};
	}
	if (contextData?.customBestiary) result.customBestiary = contextData.customBestiary;
	if (session && entityTargetScope !== "campaign") {
		result.currentSession = buildCurrentSession(session, contextData, noteToContextNote);
	}
	const selectedSessions = buildSelectedSessions(contextData?.sessions, noteToContextNote);
	if (selectedSessions.length > 0) result.selectedSessions = selectedSessions;
	if (encounterId && session) {
		const encounter = (session.data.encounters || []).find(
			(item) => String(item.id) === String(encounterId),
		);
		if (encounter) {
			result.currentEncounter = {
				id: encounter.id,
				name: encounter.name,
				monsters: (encounter.monsters || []).map((monster) => ({
					name: monster.name,
					monsterName: monster.originalBestiaryName || monster.name,
					cr: monster.cr || monster.challenge_rating,
				})),
			};
		}
	}
	return result;
}

module.exports = { buildPromptContext };
