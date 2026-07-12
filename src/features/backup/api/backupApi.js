import { request, requestBlob } from "../../../shared/api/httpClient.js";

export const backupApi = {
	exportAll: () => request("/export-all"),
	exportAllArchive: () => requestBlob("/export-all/archive"),
	importAll: (data, strategy = "append") =>
		request(`/import-all?strategy=${encodeURIComponent(strategy)}`, {
			method: "POST",
			body: JSON.stringify(data),
		}),
	importArchive: (file, mode = "all", strategy = "append") => {
		const formData = new FormData();
		formData.append("archive", file);
		const query = new URLSearchParams({
			mode: String(mode),
			strategy: String(strategy),
		});
		return request(`/import-archive?${query.toString()}`, {
			method: "POST",
			body: formData,
		});
	},
};
