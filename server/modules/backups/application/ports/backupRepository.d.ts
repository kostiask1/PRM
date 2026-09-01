export type BackupBundle = Record<string, unknown>;
export type BackupImportStrategy = "append" | "replace_by_id" | "wipe_and_replace";

export interface BackupRepository {
	listCampaignSlugs(): Promise<string[]>;
	exportCampaignBundle(slug: string): Promise<BackupBundle>;
	exportCampaignArchiveBundle(slug: string): Promise<BackupBundle>;
	exportCampaignPartialArchiveBundle(slug: string, sections: string[]): Promise<BackupBundle>;
	importCampaignPartialArchiveBundle(
		targetSlug: string,
		bundle: BackupBundle,
	): Promise<unknown>;
	clearAllCampaignData(): Promise<void>;
	findCampaignSlugById(id: string | number): Promise<string | null>;
	importCampaignBundle(
		bundle: BackupBundle,
		options?: { forcedSlug?: string; replaceExisting?: boolean },
	): Promise<unknown>;
	importCampaignArchiveBundleWithStrategy(
		bundle: BackupBundle,
		strategy: BackupImportStrategy,
	): Promise<unknown>;
}

export function createBackupRepositoryPort(
	implementation: BackupRepository,
): Readonly<BackupRepository>;
