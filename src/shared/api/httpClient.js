import { lang } from "../../services/localization.js";

const API_BASE = "/api";

function getSyncClientHeader() {
	if (typeof window === "undefined") return {};
	try {
		if (!window.__PRM_SYNC_CLIENT_ID__) {
			window.__PRM_SYNC_CLIENT_ID__ =
				typeof globalThis.crypto?.randomUUID === "function"
					? globalThis.crypto.randomUUID()
					: `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		}
		const value = window.__PRM_SYNC_CLIENT_ID__;
		return value ? { "X-Sync-Client-Id": value } : {};
	} catch {
		return {};
	}
}

export async function request(path, options = {}) {
	const isFormData = options.body instanceof FormData;
	const response = await fetch(`${API_BASE}${path}`, {
		headers: isFormData
			? { ...getSyncClientHeader(), ...(options.headers || {}) }
			: {
					"Content-Type": "application/json",
					...getSyncClientHeader(),
					...(options.headers || {}),
				},
		...options,
	});
	if (response.status === 204) return null;
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		const error = new Error(lang.t(data?.error || "Request error"));
		error.status = response.status;
		error.data = data;
		throw error;
	}
	return data;
}

export async function requestBlob(path, options = {}) {
	const response = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: { ...getSyncClientHeader(), ...(options.headers || {}) },
	});
	if (!response.ok) {
		let message = lang.t("Request error");
		try {
			const data = await response.json();
			message = data?.error ? lang.t(data.error) : message;
		} catch {
			// Ignore parse failures for binary responses.
		}
		const error = new Error(message);
		error.status = response.status;
		throw error;
	}
	return response.blob();
}

export const httpClient = { request, requestBlob };
