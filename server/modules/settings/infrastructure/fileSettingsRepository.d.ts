import type { SettingsRepository } from "../application/ports/settingsRepository";

export interface SettingsStorageAdapter {
	readSettings(): Promise<Record<string, unknown>>;
	updateSettings(
		patch: Record<string, unknown>,
	): Promise<Record<string, unknown>>;
}

export function createFileSettingsRepository(
	storage: SettingsStorageAdapter,
): Readonly<SettingsRepository>;
