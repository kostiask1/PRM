import { httpClient } from "../../../shared/api/index.js";

export const archiveApi = {
	exportAll: (options = {}) =>
		httpClient.request("/export-all", options),
	exportAllArchive: (options = {}) =>
		httpClient.requestBlob("/export-all/archive", options),
	importAll: (data, strategy = "append", options = {}) =>
		httpClient.request(
			`/import-all?strategy=${encodeURIComponent(strategy)}`,
			{
				...options,
				method: "POST",
				body: JSON.stringify(data),
			},
		),
	importArchive: (
		file,
		mode = "all",
		strategy = "append",
		options = {},
	) => {
		const formData = new FormData();
		formData.append("archive", file);
		const query = new URLSearchParams({
			mode: String(mode),
			strategy: String(strategy),
		});
		return httpClient.request(
			`/import-archive?${query.toString()}`,
			{
				...options,
				method: "POST",
				body: formData,
			},
		);
	},
};
