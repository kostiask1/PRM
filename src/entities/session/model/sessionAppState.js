export const SET_ACTIVE_SESSION = "active/setSession";

export function setActiveSessionAction(payload) {
	return {
		type: SET_ACTIVE_SESSION,
		payload: payload || null,
	};
}
