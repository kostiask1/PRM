const SELECTED_SCENE_DEFAULTS = Object.freeze({
	included: true,
	summary: true,
	goal: true,
	stakes: true,
	location: true,
	notes: true,
	encounter: true,
});

const SELECTED_SCENE_TEXT_FIELDS = ["summary", "goal", "stakes", "location"];

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function firstTruthy(values) {
	return values.find(Boolean);
}

function valueOr(value, fallback) {
	return value || fallback;
}

function readProperty(value, key) {
	if (value === null || value === undefined) return undefined;
	return value[key];
}

function readNestedProperty(value, keys) {
	return keys.reduce(readProperty, value);
}

function hasTruthyProperty(value, keys) {
	if (!value) return false;
	return Boolean(keys.map((key) => value[key]).find(Boolean));
}

function isAiIgnored(value = {}) {
	return Boolean(readProperty(value, "_aiIgnored"));
}

function projectStringNote(note) {
	return note.trim() ? { text: note } : null;
}

function isProjectableObjectNote(note) {
	if (typeof note !== "object") return false;
	return !isAiIgnored(note);
}

function projectNoteTitle(note, includeTitle) {
	if (!includeTitle) return "";
	return String(valueOr(note.title, "")).trim();
}

function hasProjectedNoteContent(title, text) {
	return Boolean(firstTruthy([title, text.trim()]));
}

function projectObjectNote(note, includeTitle) {
	if (!isProjectableObjectNote(note)) return null;
	const title = projectNoteTitle(note, includeTitle);
	const text = String(valueOr(note.text, ""));
	if (!hasProjectedNoteContent(title, text)) return null;
	const result = { id: note.id };
	if (includeTitle) result.title = title;
	result.text = text;
	return result;
}

function noteToPromptContext(note, { includeTitle = true } = {}) {
	if (!note) return null;
	if (typeof note === "string") return projectStringNote(note);
	return projectObjectNote(note, includeTitle);
}

function projectNotes(notes, noteToContextNote) {
	return asArray(notes).map(noteToContextNote).filter(Boolean);
}

function entityContextName(entity = {}) {
	const value = valueOr(entity, {});
	const firstName = valueOr(firstTruthy([value.firstName, value.first_name]), "");
	const lastName = valueOr(firstTruthy([value.lastName, value.last_name]), "");
	const fullName = `${firstName} ${lastName}`.trim();
	return firstTruthy([fullName, value.name, value.title]);
}

function characterToPromptContext(entity = {}, noteToContextNote) {
	if (isAiIgnored(entity)) return null;
	const value = valueOr(entity, {});
	return {
		id: value.id,
		slug: value.slug,
		name: entityContextName(value),
		race: value.race,
		class: value.class,
		level: value.level,
		motivation: value.motivation,
		description: value.description,
		trait: value.trait,
		notes: projectNotes(value.notes, noteToContextNote),
	};
}

function npcToPromptContext(entity = {}, noteToContextNote) {
	if (isAiIgnored(entity)) return null;
	const value = valueOr(entity, {});
	return {
		id: value.id,
		slug: value.slug,
		name: entityContextName(value),
		race: value.race,
		class: value.class,
		level: value.level,
		description: value.description,
		motivation: value.motivation,
		trait: value.trait,
		notes: projectNotes(value.notes, noteToContextNote),
	};
}

function locationToPromptContext(location = {}, noteToContextNote) {
	if (isAiIgnored(location)) return null;
	const value = valueOr(location, {});
	return {
		id: value.id,
		slug: value.slug,
		name: firstTruthy([value.name, value.title]),
		description: value.description,
		notes: projectNotes(value.notes, noteToContextNote),
	};
}

function hasCampaignEntityContent(entity) {
	return hasTruthyProperty(entity, [
		"name",
		"description",
		"motivation",
		"trait",
	]);
}

function hasSelectedNpcContent(npc) {
	return hasTruthyProperty(npc, ["name", "description", "motivation"]);
}

function hasLocationContent(location) {
	return hasTruthyProperty(location, ["name", "description"]);
}

function projectEntityList(
	values,
	projectEntity,
	noteToContextNote,
	hasContent,
) {
	return asArray(values)
		.map((entity) => projectEntity(entity, noteToContextNote))
		.filter(hasContent);
}

function projectOptionalEntityList(
	values,
	projectEntity,
	noteToContextNote,
	hasContent,
) {
	if (values === null || values === undefined) return undefined;
	return projectEntityList(
		values,
		projectEntity,
		noteToContextNote,
		hasContent,
	);
}

function projectOptionalNotes(notes, noteToContextNote) {
	if (notes === null || notes === undefined) return undefined;
	return projectNotes(notes, noteToContextNote);
}

function hasConfiguredScenes(config) {
	return Boolean(
		config.scenes &&
			typeof config.scenes === "object" &&
			Object.keys(config.scenes).length > 0,
	);
}

function isSelectedScene(scene, config, hasConfig) {
	if (!hasConfig) return true;
	const sceneId = readProperty(scene, "id");
	return Boolean(readNestedProperty(config, ["scenes", sceneId, "included"]));
}

function getSelectedSceneConfig(scene, config, hasConfig) {
	if (!hasConfig) return SELECTED_SCENE_DEFAULTS;
	return {
		...SELECTED_SCENE_DEFAULTS,
		...valueOr(readNestedProperty(config, ["scenes", readProperty(scene, "id")]), {}),
	};
}

function findEncounter(encounters, encounterId) {
	return asArray(encounters).find(
		(encounter) => String(readProperty(encounter, "id")) === String(encounterId),
	);
}

function projectMonsterName(monster) {
	return firstTruthy([
		readProperty(monster, "name"),
		readProperty(monster, "monsterName"),
	]);
}

function projectEncounterMonster(monster) {
	const value = valueOr(monster, {});
	return {
		name: value.name,
		monsterName: firstTruthy([value.originalBestiaryName, value.name]),
		cr: firstTruthy([value.cr, value.challenge_rating]),
	};
}

function projectEncounterMonsters(monsters) {
	return asArray(monsters).map(projectEncounterMonster);
}

function isEncounterCharacter(monster) {
	return readProperty(monster, "participantType") === "character";
}

function projectEditableEncounterMonster(monster) {
	return { ...valueOr(monster, {}) };
}

function projectEditableEncounterMonsters(monsters) {
	return asArray(monsters)
		.filter((monster) => !isEncounterCharacter(monster))
		.map(projectEditableEncounterMonster);
}

function appendSelectedSceneEncounter(
	result,
	scene,
	sceneConfig,
	encounters,
) {
	if (!sceneConfig.encounter) return;
	const encounterId = readProperty(scene, "encounterId");
	if (!encounterId) return;
	const encounter = findEncounter(encounters, encounterId);
	const monsters = readProperty(encounter, "monsters");
	if (monsters) {
		result.monsters = asArray(monsters).map(projectMonsterName);
	}
}

function appendSelectedSceneNotes(
	result,
	scene,
	sceneConfig,
	noteToContextNote,
) {
	if (!sceneConfig.notes) return;
	result.notes = projectNotes(readProperty(scene, "notes"), noteToContextNote);
}

function appendSelectedSceneText(result, scene, sceneConfig, field) {
	if (!sceneConfig[field]) return;
	const value = readNestedProperty(scene, ["texts", field]);
	if (value !== undefined && value !== null) result[field] = value;
}

function projectSelectedScene(
	scene,
	config,
	hasConfig,
	data,
	noteToContextNote,
) {
	const sceneConfig = getSelectedSceneConfig(scene, config, hasConfig);
	const result = { id: readProperty(scene, "id") };
	appendSelectedSceneEncounter(result, scene, sceneConfig, data.encounters);
	appendSelectedSceneNotes(result, scene, sceneConfig, noteToContextNote);
	SELECTED_SCENE_TEXT_FIELDS.forEach((field) => {
		appendSelectedSceneText(result, scene, sceneConfig, field);
	});
	return result;
}

function projectSelectedScenes(config, data, noteToContextNote) {
	const hasConfig = hasConfiguredScenes(config);
	return asArray(data.scenes)
		.filter((scene) => isSelectedScene(scene, config, hasConfig))
		.map((scene) =>
			projectSelectedScene(
				scene,
				config,
				hasConfig,
				data,
				noteToContextNote,
			),
		);
}

function appendSelectedSessionNotes(result, config, data, noteToContextNote) {
	if (config.included && config.notes && data.notes) {
		result.notes = projectNotes(data.notes, noteToContextNote);
	}
}

function appendSelectedSessionResult(result, config, data) {
	if (config.included && config.result_text && data.result_text) {
		result.result = data.result_text;
	}
}

function appendSelectedSessionScenes(result, config, data, noteToContextNote) {
	if (!config.included || !data.scenes) return;
	const scenes = projectSelectedScenes(config, data, noteToContextNote);
	if (scenes.length > 0) result.scenes = scenes;
}

function appendSelectedSessionNpcs(result, config, data, noteToContextNote) {
	if (!config.included || !Array.isArray(data.npcs) || data.npcs.length === 0) {
		return;
	}
	result.npcs = projectEntityList(
		data.npcs,
		npcToPromptContext,
		noteToContextNote,
		hasSelectedNpcContent,
	);
}

function appendSelectedSessionLocations(
	result,
	config,
	data,
	noteToContextNote,
) {
	if (
		!config.included ||
		!Array.isArray(data.locations) ||
		data.locations.length === 0
	) {
		return;
	}
	result.locations = projectEntityList(
		data.locations,
		locationToPromptContext,
		noteToContextNote,
		hasLocationContent,
	);
}

function projectSelectedSession(session, noteToContextNote) {
	const value = valueOr(session, {});
	const config = valueOr(value.conf, {});
	const data = valueOr(value.data, {});
	const result = {
		id: value.slug,
		slug: value.slug,
		name: value.name,
	};
	appendSelectedSessionNotes(result, config, data, noteToContextNote);
	appendSelectedSessionResult(result, config, data);
	appendSelectedSessionScenes(result, config, data, noteToContextNote);
	appendSelectedSessionNpcs(result, config, data, noteToContextNote);
	appendSelectedSessionLocations(result, config, data, noteToContextNote);
	return result;
}

function hasSelectedSessionContent(session) {
	return hasTruthyProperty(session, [
		"notes",
		"result",
		"scenes",
		"npcs",
		"locations",
	]);
}

function buildSelectedSessions(sessions, noteToContextNote) {
	return asArray(sessions)
		.map((session) => projectSelectedSession(session, noteToContextNote))
		.filter(hasSelectedSessionContent);
}

function getCurrentSessionData(session, contextData) {
	const currentData = readNestedProperty(contextData, ["currentSession", "data"]);
	if (currentData && typeof currentData === "object") return currentData;
	return valueOr(session.data, {});
}

function projectCurrentScene(scene, noteToContextNote) {
	const value = valueOr(scene, {});
	return {
		id: value.id,
		texts: value.texts,
		encounterId: valueOr(value.encounterId, ""),
		notes: projectNotes(value.notes, noteToContextNote),
		npcs: valueOr(value.npcs, []),
	};
}

function projectCurrentEncounter(encounter, creatureEditingEnabled = false) {
	const value = valueOr(encounter, {});
	return {
		id: value.id,
		name: value.name,
		monsters: creatureEditingEnabled
			? projectEditableEncounterMonsters(value.monsters)
			: projectEncounterMonsters(value.monsters),
	};
}

function appendCurrentSessionScenes(result, data, noteToContextNote) {
	if (!Array.isArray(data.scenes) || data.scenes.length === 0) return;
	result.scenes = data.scenes.map((scene) =>
		projectCurrentScene(scene, noteToContextNote),
	);
}

function appendCurrentSessionEncounters(result, data) {
	if (!Array.isArray(data.encounters) || data.encounters.length === 0) return;
	result.encounters = data.encounters.map((encounter) =>
		projectCurrentEncounter(encounter),
	);
}

function appendCurrentSessionNpcs(result, data, noteToContextNote) {
	if (!Array.isArray(data.npcs) || data.npcs.length === 0) return;
	result.npcs = projectEntityList(
		data.npcs,
		npcToPromptContext,
		noteToContextNote,
		hasCampaignEntityContent,
	);
}

function appendCurrentSessionLocations(result, data, noteToContextNote) {
	if (!Array.isArray(data.locations) || data.locations.length === 0) return;
	result.locations = projectEntityList(
		data.locations,
		locationToPromptContext,
		noteToContextNote,
		hasLocationContent,
	);
}

function buildCurrentSession(session, contextData, noteToContextNote) {
	const data = getCurrentSessionData(session, contextData);
	const currentSession = valueOr(readProperty(contextData, "currentSession"), {});
	const result = {
		id: session.id,
		slug: currentSession.slug,
		fileName: currentSession.fileName,
		name: firstTruthy([currentSession.name, session.name]),
	};
	appendCurrentSessionScenes(result, data, noteToContextNote);
	appendCurrentSessionEncounters(result, data);
	appendCurrentSessionNpcs(result, data, noteToContextNote);
	appendCurrentSessionLocations(result, data, noteToContextNote);
	return result;
}

function buildCampaignContext(campaign, campaignData, noteToContextNote) {
	const data = valueOr(campaignData, {});
	return {
		name: campaign.name,
		description: campaign.description,
		notes: projectOptionalNotes(data.notes, noteToContextNote),
		characters: projectOptionalEntityList(
			data.characters,
			characterToPromptContext,
			noteToContextNote,
			hasCampaignEntityContent,
		),
		npcs: projectOptionalEntityList(
			data.npcs,
			npcToPromptContext,
			noteToContextNote,
			hasCampaignEntityContent,
		),
		locations: projectOptionalEntityList(
			data.locations,
			locationToPromptContext,
			noteToContextNote,
			hasLocationContent,
		),
	};
}

function appendCampaignContext(result, campaign, contextData, noteToContextNote) {
	if (!campaign) return;
	result.campaign = buildCampaignContext(
		campaign,
		readProperty(contextData, "campaign"),
		noteToContextNote,
	);
}

function appendCustomBestiaryContext(result, contextData) {
	const customBestiary = readProperty(contextData, "customBestiary");
	if (customBestiary) {
		result.customBestiary = customBestiary;
	}
}

function appendCurrentSessionContext(
	result,
	session,
	contextData,
	entityTargetScope,
	noteToContextNote,
) {
	if (!session || entityTargetScope === "campaign") return;
	result.currentSession = buildCurrentSession(
		session,
		contextData,
		noteToContextNote,
	);
}

function appendSelectedSessionsContext(result, contextData, noteToContextNote) {
	const selectedSessions = buildSelectedSessions(
		readProperty(contextData, "sessions"),
		noteToContextNote,
	);
	if (selectedSessions.length > 0) result.selectedSessions = selectedSessions;
}

function appendCurrentEncounterContext(
	result,
	session,
	encounterId,
	creatureEditingEnabled,
) {
	if (!encounterId) return;
	if (!session) return;
	const encounter = findEncounter(
		readNestedProperty(session, ["data", "encounters"]),
		encounterId,
	);
	if (encounter) {
		result.currentEncounter = projectCurrentEncounter(
			encounter,
			creatureEditingEnabled,
		);
	}
}

function createNoteProjector(simplifiedNotesEnabled) {
	return (note) =>
		noteToPromptContext(note, { includeTitle: !simplifiedNotesEnabled });
}

function buildPromptContext({
	campaign,
	session,
	contextData,
	entityTargetScope,
	encounterId,
	simplifiedNotesEnabled = false,
	encounterCreatureEditingEnabled = false,
}) {
	const noteToContextNote = createNoteProjector(simplifiedNotesEnabled);
	const result = {};
	appendCampaignContext(result, campaign, contextData, noteToContextNote);
	appendCustomBestiaryContext(result, contextData);
	appendCurrentSessionContext(
		result,
		session,
		contextData,
		entityTargetScope,
		noteToContextNote,
	);
	appendSelectedSessionsContext(result, contextData, noteToContextNote);
	appendCurrentEncounterContext(
		result,
		session,
		encounterId,
		encounterCreatureEditingEnabled,
	);
	return result;
}

module.exports = { buildPromptContext };
