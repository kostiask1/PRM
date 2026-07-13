function buildImageTask({ imageTarget, sceneId }) {
	if (imageTarget?.type) {
		return `TASK: Generate a detailed image prompt for the selected ${imageTarget.type} from IMAGE TARGET.\n`;
	}
	if (sceneId) {
		return `TASK: Generate an image prompt for scene ID: ${sceneId}.\n`;
	}
	return "TASK: Generate a detailed image prompt based on INPUT DATA and USER INSTRUCTIONS. Use the current context to infer the subject, composition, mood, and relevant details.\n";
}

function buildScopedEntityTask({ entity, entityTargetScope }) {
	if (entity === "npc") {
		const sessionRule = "Do not create session copies of campaign-scoped NPCs. If an existing campaign NPC is only referenced in session content, use [Exact Entity Name] in text fields. If the user request or the NPC's logical use means that campaign NPC should become session-only, use moveScope from campaign to session.\n";
		if (entityTargetScope === "mixed") {
			return `TASK: Create or update NPC operations for the current session and campaign as requested. Use entity "npc" only, identify existing targets by id, and choose "scope": "campaign" or "scope": "session" separately for each NPC operation. Default new NPCs to "scope": "session"; use "scope": "campaign" only for clearly recurring or campaign-important NPCs.\n${sessionRule}`;
		}
		const target = entityTargetScope === "session" ? "current session" : "campaign";
		return `TASK: Create or update NPC operations for this ${target} as requested. Use entity "npc" only, identify existing targets by id, and use "${entityTargetScope}" scope by default.\n${entityTargetScope === "session" ? sessionRule : ""}`;
	}
	const sessionRule = "Do not create session copies of campaign-scoped locations/factions. If an existing campaign location/faction is only referenced in session content, use [Exact Entity Name] in text fields. If the user request or the location/faction's logical use means that campaign entity should become session-only, use moveScope from campaign to session.\n";
	if (entityTargetScope === "mixed") {
		return `TASK: Create or update location/faction operations for the current session and campaign as requested. Use entity "location" only, identify existing targets by id, and choose "scope": "campaign" or "scope": "session" separately for each location/faction operation. Default new locations/factions to "scope": "session"; use "scope": "campaign" only for major reusable places, factions, regions, organizations, or campaign hubs.\n${sessionRule}`;
	}
	const target = entityTargetScope === "session" ? "current session" : "campaign";
	return `TASK: Create or update location/faction operations for this ${target} as requested. Use entity "location" only, identify existing targets by id, and use "${entityTargetScope}" scope by default.\n${entityTargetScope === "session" ? sessionRule : ""}`;
}

function buildTaskInstructions({
	useKey,
	imageTarget,
	sceneId,
	entityTargetScope,
	encounterId,
	customMonsterGenerationEnabled,
	encounterGenerationEnabled,
}) {
	if (useKey === "image") return buildImageTask({ imageTarget, sceneId });
	if (useKey === "character") {
		return 'TASK: Create or update player character operations requested by USER INSTRUCTIONS. Use entity "character" only and identify existing targets by id when available.\n';
	}
	if (useKey === "custom-monster") {
		return `TASK: Create or update custom D&D 5.5e bestiary monster operations requested by USER INSTRUCTIONS. Use entity "monster" only and follow the custom monster schema from system instructions.
If INPUT DATA.customBestiary.selectedMonster exists and selectedMonsterMode is "create-based", use it only as reference and create a new monster.
When creating a monster based on an existing one, give the new monster a distinct "name" unless USER INSTRUCTIONS explicitly ask to replace or keep the same name.
If selectedMonster exists and selectedMonsterMode is not "create-based", update that monster by id and return only changed fields in patch.\n`;
	}
	if (useKey === "npc") {
		return buildScopedEntityTask({
			entity: "npc",
			entityTargetScope,
		});
	}
	if (useKey === "location") {
		return buildScopedEntityTask({
			entity: "location",
			entityTargetScope,
		});
	}
	if (useKey === "encounter") {
		let task = `TASK: Update current combat encounter (id: ${encounterId}) according to USER INSTRUCTIONS. Use exact official monster names or exact INPUT DATA.customBestiary.monsterNames values in monsterName.\n`;
		if (customMonsterGenerationEnabled) {
			task += "Custom monster creation is allowed only when existing official or custom monsters do not fit well.\n";
		}
		return task;
	}
	if (useKey === "scene") {
		let task = "TASK: Based on current session and context, apply the user's requested session changes.\n";
		if (entityTargetScope !== "campaign") {
			task += 'When existing campaign NPCs, locations, or factions are used in this session, write them as [Exact Entity Name] mentions in scene text or notes instead of creating copied session entities. For new NPCs/locations/factions, choose "scope": "session" by default; use "scope": "campaign" only for reusable campaign entities. Use moveScope whenever the entity\'s logical role shows it belongs in the other scope.\n';
		}
		if (encounterGenerationEnabled) {
			task += "Encounter generation is enabled: any combat encounter you create must be connected to exactly one scene with encounterClientId in the same JSON response. Never create orphan encounters.\n";
		}
		return task;
	}
	if (useKey === "campaign") {
		return 'TASK: Apply the user\'s requested campaign changes.\nIf USER INSTRUCTIONS ask to create, rewrite, expand, summarize, or otherwise change the campaign premise, overview, story, concept, or main description, return an update operation for entity "campaign" with patch.description. Do not create a note for this unless USER INSTRUCTIONS explicitly ask for a note.\n';
	}
	return "";
}

function buildUserPrompt({
	contextJson,
	useKey,
	imageTarget,
	sceneId,
	entityTargetScope,
	encounterId,
	customMonsterGenerationEnabled,
	encounterGenerationEnabled,
	userInstructions,
}) {
	let prompt = `INPUT DATA (JSON):\n${JSON.stringify(contextJson, null, 2)}\n\n`;
	if (useKey === "image" && imageTarget && typeof imageTarget === "object") {
		prompt += `IMAGE TARGET (JSON):\n${JSON.stringify(imageTarget, null, 2)}\n\n`;
	}
	prompt += buildTaskInstructions({
		useKey,
		imageTarget,
		sceneId,
		entityTargetScope,
		encounterId,
		customMonsterGenerationEnabled,
		encounterGenerationEnabled,
	});
	prompt += `USER INSTRUCTIONS (PRIORITY): ${userInstructions || ""}\n`;
	return prompt;
}

module.exports = { buildTaskInstructions, buildUserPrompt };
