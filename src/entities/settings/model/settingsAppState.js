export const SET_LANGUAGE = "language/set";
export const SET_UI_SETTINGS = "ui/setSettings";

export function setLanguageAction(payload) {
	return {
		type: SET_LANGUAGE,
		payload: String(payload || "").toLowerCase(),
	};
}

export function setUiSettingsAction(payload) {
	const nextPayload = {};
	if (payload && Object.prototype.hasOwnProperty.call(payload, "theme")) {
		nextPayload.theme = payload.theme === "dark" ? "dark" : "light";
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "encounterViewMode")
	) {
		nextPayload.encounterViewMode =
			payload.encounterViewMode === "grid" ? "grid" : "single";
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "encounterGridColumns")
	) {
		const columns = Number.parseInt(payload.encounterGridColumns, 10);
		nextPayload.encounterGridColumns = Math.min(
			4,
			Math.max(1, Number.isFinite(columns) ? columns : 2),
		);
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "simplifiedNotes")
	) {
		nextPayload.simplifiedNotes = Boolean(payload.simplifiedNotes);
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "aiBasePrompt")
	) {
		nextPayload.aiBasePrompt = String(payload.aiBasePrompt || "");
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "imagePromptBasePrompt")
	) {
		nextPayload.imagePromptBasePrompt = String(
			payload.imagePromptBasePrompt || "",
		);
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "campaignAiBasePrompts")
	) {
		nextPayload.campaignAiBasePrompts =
			payload.campaignAiBasePrompts &&
			typeof payload.campaignAiBasePrompts === "object" &&
			!Array.isArray(payload.campaignAiBasePrompts)
				? Object.fromEntries(
						Object.entries(payload.campaignAiBasePrompts).map(
							([slug, prompt]) => [String(slug), String(prompt || "")],
						),
					)
				: {};
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(
			payload,
			"campaignImagePromptBasePrompts",
		)
	) {
		nextPayload.campaignImagePromptBasePrompts =
			payload.campaignImagePromptBasePrompts &&
			typeof payload.campaignImagePromptBasePrompts === "object" &&
			!Array.isArray(payload.campaignImagePromptBasePrompts)
				? Object.fromEntries(
						Object.entries(payload.campaignImagePromptBasePrompts).map(
							([slug, prompt]) => [String(slug), String(prompt || "")],
						),
					)
				: {};
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "ignoreSourcesList")
	) {
		nextPayload.ignoreSourcesList = Array.from(
			new Set(
				(Array.isArray(payload.ignoreSourcesList)
					? payload.ignoreSourcesList
					: []
				)
					.map((source) => String(source || "").trim().toUpperCase())
					.filter(Boolean),
			),
		).sort((a, b) => a.localeCompare(b));
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "autoApplyAiChanges")
	) {
		nextPayload.autoApplyAiChanges = payload.autoApplyAiChanges !== false;
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "useSearchDebounce")
	) {
		nextPayload.useSearchDebounce = payload.useSearchDebounce !== false;
	}

	return {
		type: SET_UI_SETTINGS,
		payload: nextPayload,
	};
}
