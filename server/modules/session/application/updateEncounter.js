function createUpdateEncounterCommand(repository) {
	return async function updateEncounter({
		campaignSlug,
		fileName,
		encounterId,
		patch = {},
	}) {
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
		const encounter = {
			...encounters[index],
			...patch,
			id: encounters[index].id,
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
		return { encounter, session: savedSession };
	};
}

module.exports = { createUpdateEncounterCommand };
