import { request } from "../../../shared/api/index.ts";

export type SettingsPayload = Record<string, unknown>;

export const settingsApi = {
	getSettings: (): Promise<SettingsPayload | null> => request("/settings"),
	updateSettings: (
		payload: SettingsPayload,
	): Promise<SettingsPayload | null> =>
		request("/settings", {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
};
