import { request } from "../../../shared/api/index.ts";

export const parserActionsApi = {
	list: (options: RequestInit = {}) =>
		request<unknown>("/spells/parser-actions", options),
};
