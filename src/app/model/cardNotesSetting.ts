import { settingsApi } from "../../features/settings/index.js";
import { lang } from "../../shared/lib/index.js";
import { alert, setUiSettingsAction } from "../../shared/model/index.js";
import { appStore } from "./appStore.ts";

let queue: Promise<void> = Promise.resolve();
let revision = 0;
let savedValue: boolean | undefined;
let pendingCount = 0;

export function setCardNotesViewMode(showAll: boolean): void {
	if (savedValue === undefined) savedValue = appStore.getState().ui.showAllCardNotes;
	const currentRevision = ++revision;
	pendingCount += 1;
	appStore.dispatch(setUiSettingsAction({ showAllCardNotes: showAll }));
	queue = queue.then(async () => {
		try {
			await settingsApi.updateSettings({ showAllCardNotes: showAll });
			savedValue = showAll;
		} catch (error) {
			console.error("Failed to save card notes setting", error);
			if (revision === currentRevision) {
				appStore.dispatch(setUiSettingsAction({ showAllCardNotes: savedValue }));
				appStore.dispatch(alert({ type: "error", title: lang.t("Error"), message: lang.t("Failed to save card notes setting") }));
			}
		} finally {
			pendingCount -= 1;
			if (pendingCount === 0) savedValue = undefined;
		}
	});
}
