import type {
	SettingsRecord,
	SettingsRepository,
} from "./ports/settingsRepository";

export interface SettingsCommands {
	get(): Promise<SettingsRecord>;
	update(input: { patch?: SettingsRecord }): Promise<SettingsRecord>;
}

export function createSettingsCommands(
	repository: SettingsRepository,
): SettingsCommands;
