function findById(items, id) {
	return (items || []).find((item) => String(item.id) === String(id));
}

function readSessionArray(session, property) {
	return Array.isArray(session.data?.[property])
		? session.data[property]
		: [];
}

function requireScene(scenes, sceneId) {
	const scene = findById(scenes, sceneId);
	if (scene) return scene;
	const error = new Error("Scene not found.");
	error.status = 404;
	throw error;
}

function findLinkedEncounter(scene, encounters) {
	if (scene.encounterId === null || scene.encounterId === undefined) {
		return undefined;
	}
	return findById(encounters, scene.encounterId);
}

function createExistingEncounterResult(session, fileName, encounter) {
	return {
		created: false,
		encounter,
		session: { ...session, fileName },
	};
}

function normalizeEncounterName(name) {
	return String(name || "").trim() || "Encounter";
}

function createEncounter(repository, name) {
	return {
		id: repository.createId(),
		name: normalizeEncounterName(name),
		monsters: [],
	};
}

function linkSceneToEncounter(scene, sceneId, encounterId) {
	return String(scene.id) === String(sceneId)
		? { ...scene, encounterId }
		: scene;
}

function createNextSession(
	session,
	scenes,
	encounters,
	sceneId,
	encounter,
) {
	return {
		...session,
		data: {
			...session.data,
			encounters: [...encounters, encounter],
			scenes: scenes.map((scene) =>
				linkSceneToEncounter(scene, sceneId, encounter.id),
			),
		},
	};
}

function createSceneEncounterCommand(repository) {
	return async function createSceneEncounter({
		campaignSlug,
		fileName,
		sceneId,
		name,
	}) {
		const session = await repository.read(campaignSlug, fileName);
		const scenes = readSessionArray(session, "scenes");
		const scene = requireScene(scenes, sceneId);
		const encounters = readSessionArray(session, "encounters");
		const existing = findLinkedEncounter(scene, encounters);
		if (existing)
			return createExistingEncounterResult(session, fileName, existing);
		const encounter = createEncounter(repository, name);
		const nextSession = createNextSession(
			session,
			scenes,
			encounters,
			sceneId,
			encounter,
		);
		const savedSession = await repository.write(
			campaignSlug,
			fileName,
			nextSession,
		);
		return { created: true, encounter, session: savedSession };
	};
}

module.exports = { createSceneEncounterCommand, findById };
