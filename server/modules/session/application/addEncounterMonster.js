function createAddEncounterMonsterCommand(repository) {
	return async function addEncounterMonster({
		campaignSlug,
		fileName,
		encounterId,
		monster,
	}) {
		if (!monster || typeof monster !== "object" || Array.isArray(monster)) {
			const error = new Error("Encounter monster must be an object.");
			error.status = 400;
			throw error;
		}

		const session = await repository.read(campaignSlug, fileName);
		const encounters = Array.isArray(session.data?.encounters)
			? session.data.encounters
			: [];
		const index = encounters.findIndex(
			(item) => String(item.id) === String(encounterId),
		);
		if (index < 0) {
			const error = new Error("Encounter not found.");
			error.status = 404;
			throw error;
		}

		const savedMonster = { ...monster };
		const encounter = {
			...encounters[index],
			monsters: [
				...(Array.isArray(encounters[index].monsters)
					? encounters[index].monsters
					: []),
				savedMonster,
			],
		};
		const nextEncounters = [...encounters];
		nextEncounters[index] = encounter;
		const nextSession = {
			...session,
			data: { ...session.data, encounters: nextEncounters },
		};
		const savedSession = await repository.write(
			campaignSlug,
			fileName,
			nextSession,
		);

		return { monster: savedMonster, encounter, session: savedSession };
	};
}

module.exports = { createAddEncounterMonsterCommand };
