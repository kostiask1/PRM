export const SET_ACTIVE_ENCOUNTER = "active/setEncounter";

export function setActiveEncounterAction(payload) {
	return {
		type: SET_ACTIVE_ENCOUNTER,
		payload: payload || null,
	};
}
