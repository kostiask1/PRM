function findById(items, id) {
	return (items || []).find((item) => String(item.id) === String(id));
}

function createSceneEncounterCommand(repository) {
	return async function createSceneEncounter({
		campaignSlug,
		fileName,
		sceneId,
		name,
	}) {
		const session = await repository.read(campaignSlug, fileName);
		const scenes = Array.isArray(session.data?.scenes) ? session.data.scenes : [];
		const scene = findById(scenes, sceneId);
		if (!scene) {
			const error = new Error("Scene not found.");
			error.status = 404;
			throw error;
		}

		const encounters = Array.isArray(session.data?.encounters)
			? session.data.encounters
			: [];
		if (scene.encounterId !== null && scene.encounterId !== undefined) {
			const existing = findById(encounters, scene.encounterId);
			if (existing) {
				return {
					created: false,
					encounter: existing,
					session: { ...session, fileName },
				};
			}
		}

		const encounter = {
			id: repository.createId(),
			name: String(name || "").trim() || "Encounter",
			monsters: [],
		};
		const nextSession = {
			...session,
			data: {
				...session.data,
				encounters: [...encounters, encounter],
				scenes: scenes.map((item) =>
					String(item.id) === String(sceneId)
						? { ...item, encounterId: encounter.id }
						: item,
				),
			},
		};
		const savedSession = await repository.write(
			campaignSlug,
			fileName,
			nextSession,
		);
		return { created: true, encounter, session: savedSession };
	};
}

module.exports = { createSceneEncounterCommand, findById };
