export type SettingsRecord = Record<string, unknown>;

export interface SettingsRepository {
	read(): Promise<SettingsRecord>;
	update(patch: SettingsRecord): Promise<SettingsRecord>;
}

export function createSettingsRepositoryPort(
	implementation: SettingsRepository,
): Readonly<SettingsRepository>;
