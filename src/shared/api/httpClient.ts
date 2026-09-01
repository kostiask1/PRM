import { lang } from "../lib/localization.js";

declare global {
	interface Window {
		__PRM_SYNC_CLIENT_ID__?: string;
	}
}

export interface HttpRequestError extends Error {
	status: number;
	data?: unknown;
}

const API_BASE = "/api";
export const API_MUTATION_EVENT = "prm:api-mutation-complete";

function getSyncClientHeader(): Record<string, string> {
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

function getErrorText(value: unknown): string {
	if (!value || typeof value !== "object") return "Request error";
	const error = (value as { error?: unknown }).error;
	return error ? String(error) : "Request error";
}

export async function request<TResult = unknown>(
	path: string,
	options: RequestInit = {},
): Promise<TResult | null> {
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
	const notifyMutation = () => {
		if (
			typeof window !== "undefined" &&
			options.method &&
			options.method !== "GET"
		) {
			window.dispatchEvent(
				new CustomEvent(API_MUTATION_EVENT, {
					detail: { path, method: options.method },
				}),
			);
		}
	};
	if (response.status === 204) {
		notifyMutation();
		return null;
	}
	const data: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const error = new Error(lang.t(getErrorText(data))) as HttpRequestError;
		error.status = response.status;
		error.data = data;
		throw error;
	}
	notifyMutation();
	return data as TResult;
}

export async function requestBlob(
	path: string,
	options: RequestInit = {},
): Promise<Blob> {
	const response = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: { ...getSyncClientHeader(), ...(options.headers || {}) },
	});
	if (!response.ok) {
		let message = lang.t("Request error");
		try {
			const data: unknown = await response.json();
			message = lang.t(getErrorText(data));
		} catch {
			// Ignore parse failures for binary responses.
		}
		const error = new Error(message) as HttpRequestError;
		error.status = response.status;
		throw error;
	}
	return response.blob();
}

export function isAbortError(error: unknown): boolean {
	return (error as { name?: unknown } | null | undefined)?.name === "AbortError";
}

export const httpClient = { request, requestBlob };
