import { request, requestBlob } from "../../../shared/api/index.ts";

export type BackupImportStrategy = "append" | "replace_by_id" | "wipe_and_replace";
export type BackupImportMode = "all" | "campaign";
export type CampaignBackupBundle = Record<string, unknown>;

export interface BackupImportResult {
	ok: true;
	imported: number;
	strategy: BackupImportStrategy;
}

export const backupApi = {
	exportAll: () => request<CampaignBackupBundle[]>("/export-all"),
	exportAllArchive: () => requestBlob("/export-all/archive"),
	importAll: (
		data: CampaignBackupBundle | CampaignBackupBundle[],
		strategy: BackupImportStrategy = "append",
	) =>
		request<BackupImportResult>(
			`/import-all?strategy=${encodeURIComponent(strategy)}`,
			{ method: "POST", body: JSON.stringify(data) },
		),
	importArchive: (
		file: Blob,
		mode: BackupImportMode = "all",
		strategy: BackupImportStrategy = "append",
	) => {
		const formData = new FormData();
		formData.append("archive", file);
		const query = new URLSearchParams({ mode, strategy });
		return request<BackupImportResult>(`/import-archive?${query.toString()}`, {
			method: "POST",
			body: formData,
		});
	},
};
