import {
	dataSyncReceivedAction,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
} from "../actions/app";
import { appStore } from "../store/appStore";

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 10000;

let clientId = null;
let socket = null;
let reconnectTimer = null;
let reconnectDelay = RECONNECT_BASE_DELAY;
let initialized = false;

export function getSyncClientId() {
	if (clientId) return clientId;
	if (window.__PRM_SYNC_CLIENT_ID__) {
		clientId = window.__PRM_SYNC_CLIENT_ID__;
		return clientId;
	}

	clientId =
		typeof globalThis.crypto?.randomUUID === "function"
			? globalThis.crypto.randomUUID()
			: `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	window.__PRM_SYNC_CLIENT_ID__ = clientId;
	return clientId;
}

function getSyncUrl() {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const url = new URL(`${protocol}//${window.location.host}/api/sync`);
	url.searchParams.set("client", getSyncClientId());
	return url.toString();
}

function isCampaignScopedEvent(event) {
	return [
		"campaigns",
		"sessions",
		"entities",
		"images",
		"import",
		"ai",
	].includes(event?.resource);
}

function handleDataChanged(event) {
	if (!event || event.type !== "data:changed") return;

	appStore.dispatch(dataSyncReceivedAction(event));

	if (event.resource === "entities") {
		appStore.dispatch(refreshEntitiesAction());
	}

	if (isCampaignScopedEvent(event)) {
		appStore.dispatch(requestCampaignsReloadAction());
	}
}

function scheduleReconnect() {
	if (reconnectTimer) return;

	reconnectTimer = window.setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, reconnectDelay);
	reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY);
}

function connect() {
	if (socket && socket.readyState <= WebSocket.OPEN) return;

	socket = new WebSocket(getSyncUrl());
	socket.addEventListener("open", () => {
		reconnectDelay = RECONNECT_BASE_DELAY;
	});
	socket.addEventListener("message", (event) => {
		try {
			handleDataChanged(JSON.parse(event.data));
		} catch (error) {
			console.error("Failed to parse realtime sync event", error);
		}
	});
	socket.addEventListener("close", scheduleReconnect);
	socket.addEventListener("error", () => {
		socket?.close();
	});
}

export function initRealtimeSync() {
	if (initialized || typeof window === "undefined" || !("WebSocket" in window)) {
		return;
	}
	initialized = true;
	connect();
}
