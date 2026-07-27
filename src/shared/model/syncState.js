export const DATA_SYNC_RECEIVED = "sync/dataReceived";

export function dataSyncReceivedAction(payload) {
	return {
		type: DATA_SYNC_RECEIVED,
		payload: payload && typeof payload === "object" ? payload : null,
	};
}
