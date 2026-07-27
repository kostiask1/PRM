const {
	exists,
	readJson,
	writeJson,
} = require("../../infrastructure/jsonFileStore");
const { SETTINGS_PATH } = require("../../infrastructure/storagePaths");

const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";

const DEFAULT_APP_SETTINGS = Object.freeze({
	language: "en",
	theme: "light",
	encounterViewMode: "grid",
	encounterGridColumns: 3,
	simplifiedNotes: false,
	aiBasePrompt: "",
	imagePromptBasePrompt: DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	campaignAiBasePrompts: {},
	campaignImagePromptBasePrompts: {},
	ignoreSourcesList: [],
	autoApplyAiChanges: false,
	useSearchDebounce: true,
});

function normalizeSourceList(value) {
	const seen = new Set();
	for (const source of Array.isArray(value) ? value : []) {
		const normalized = String(source || "").trim().toUpperCase();
		if (normalized) seen.add(normalized);
	}
	return [...seen].sort((a, b) => a.localeCompare(b));
}

function normalizePromptMap(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? Object.fromEntries(
				Object.entries(value)
					.map(([slug, prompt]) => [
						String(slug || "").trim(),
						String(prompt || ""),
					])
					.filter(([slug]) => slug),
			)
		: {};
}

function normalizeSettings(settings = {}) {
	const columns = Number.parseInt(settings.encounterGridColumns, 10);
	return {
		language: settings.language === "uk" ? "uk" : "en",
		theme: settings.theme === "dark" ? "dark" : "light",
		encounterViewMode:
			settings.encounterViewMode === "grid" ? "grid" : "single",
		encounterGridColumns: Math.min(
			4,
			Math.max(1, Number.isFinite(columns) ? columns : 2),
		),
		simplifiedNotes: Boolean(settings.simplifiedNotes),
		aiBasePrompt: String(settings.aiBasePrompt || ""),
		imagePromptBasePrompt:
			settings.imagePromptBasePrompt === undefined
				? DEFAULT_IMAGE_PROMPT_BASE_PROMPT
				: String(settings.imagePromptBasePrompt || ""),
		campaignAiBasePrompts: normalizePromptMap(settings.campaignAiBasePrompts),
		campaignImagePromptBasePrompts: normalizePromptMap(
			settings.campaignImagePromptBasePrompts,
		),
		ignoreSourcesList: normalizeSourceList(settings.ignoreSourcesList),
		autoApplyAiChanges: settings.autoApplyAiChanges !== false,
		useSearchDebounce: settings.useSearchDebounce !== false,
	};
}

function createSettingsRepository(overrides = {}) {
	const dependencies = {
		exists,
		readJson,
		settingsPath: SETTINGS_PATH,
		writeJson,
		...overrides,
	};

	async function readSettings() {
		if (!(await dependencies.exists(dependencies.settingsPath))) {
			await dependencies.writeJson(
				dependencies.settingsPath,
				DEFAULT_APP_SETTINGS,
			);
			return { ...DEFAULT_APP_SETTINGS };
		}
		try {
			const saved = await dependencies.readJson(dependencies.settingsPath);
			const normalized = normalizeSettings(saved);
			if (JSON.stringify(saved) !== JSON.stringify(normalized)) {
				await dependencies.writeJson(dependencies.settingsPath, normalized);
			}
			return normalized;
		} catch {
			await dependencies.writeJson(
				dependencies.settingsPath,
				DEFAULT_APP_SETTINGS,
			);
			return { ...DEFAULT_APP_SETTINGS };
		}
	}

	async function updateSettings(patch = {}) {
		const current = await readSettings();
		const next = normalizeSettings({ ...current, ...patch });
		await dependencies.writeJson(dependencies.settingsPath, next);
		return next;
	}

	return { readSettings, updateSettings };
}

const settingsRepository = createSettingsRepository();

module.exports = {
	DEFAULT_APP_SETTINGS,
	DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	...settingsRepository,
	createSettingsRepository,
	normalizeSettings,
	normalizeSourceList,
};
