import { settingsApi } from "../../../features/settings/index.js";
import type { EncounterPageUiSettingsPatch } from "./EncounterPageRuntime.tsx";

interface Options { patchUiSettings(patch: EncounterPageUiSettingsPatch): void; }

export function useEncounterDisplaySettings({ patchUiSettings }: Options) {
	const updateViewMode = (mode: "grid" | "single") => {
		const nextMode = mode === "grid" ? "grid" : "single";
		patchUiSettings({ encounterViewMode: nextMode });
		settingsApi.updateSettings({ encounterViewMode: nextMode }).catch((error) => {
			console.error("Failed to save encounter view mode setting", error);
		});
	};
	const updateGridColumns = (columns: number) => {
		const nextColumns = Math.min(4, Math.max(1, Number(columns) || 2));
		patchUiSettings({ encounterGridColumns: nextColumns });
		settingsApi.updateSettings({ encounterGridColumns: nextColumns }).catch((error) => {
			console.error("Failed to save encounter grid columns setting", error);
		});
	};
	return { updateViewMode, updateGridColumns };
}
