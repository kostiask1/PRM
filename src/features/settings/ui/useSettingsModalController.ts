import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { campaignApi } from "../../../entities/campaign/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import { spellApi } from "../../../entities/spell/index.js";
import {
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeIgnoreSourcesList,
} from "../../../entities/reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import { settingsApi } from "../api/settingsApi.ts";
import {
	DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	GLOBAL_SETTINGS_SCOPE,
	buildCampaignIgnoreSourcesMap,
	buildPromptSettingsPayload,
	mergeContentSourceOptions,
	normalizeSavedIgnoreSources,
	normalizeSavedPromptSettings,
	normalizeSettingsCampaigns,
	resolveSelectedPromptSettings,
	resolveSelectedSimplifiedNotesSettings,
	resolveSelectedSourceSettings,
	resolveSettingsScope,
	setCampaignIgnoreSourcesForScope,
	setCampaignSimplifiedNotesSetting,
	setSettingsPromptForScope,
	type CampaignIgnoreSourcesMap,
	type SettingsPromptMap,
	type SettingsSaveStatus,
} from "../model/settingsModal.ts";
import { getNextTheme } from "../model/theme.ts";
import type { SettingsModalViewProps } from "./SettingsModalView.tsx";
import type { SettingsModalRuntime } from "./settingsModalComposition.ts";

function useSettingsScopeRecovery(options: {
	selectedScope: string;
	setSelectedScope: (scope: string) => void;
	activeCampaignSlug: string | null;
	campaigns: ReturnType<typeof normalizeSettingsCampaigns>;
}): void {
	const { selectedScope, setSelectedScope, activeCampaignSlug, campaigns } =
		options;
	useEffect(() => {
		const nextScope = resolveSettingsScope(
			selectedScope,
			activeCampaignSlug,
			campaigns,
		);
		if (nextScope !== selectedScope) setSelectedScope(nextScope);
	}, [activeCampaignSlug, campaigns, selectedScope, setSelectedScope]);
}

interface QueuedAutosaveOptions<T> {
	delay?: number;
	onSave: (value: T, isLatest: () => boolean) => Promise<void>;
}

function useQueuedAutosave<T>({
	delay = 500,
	onSave,
}: QueuedAutosaveOptions<T>) {
	const onSaveRef = useRef(onSave);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingRef = useRef<{ value: T; version: number } | null>(null);
	const queueRef = useRef<Promise<void>>(Promise.resolve());
	const versionRef = useRef(0);
	onSaveRef.current = onSave;

	const flush = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = null;
		const pending = pendingRef.current;
		pendingRef.current = null;
		if (!pending) return;

		queueRef.current = queueRef.current
			.catch(() => undefined)
			.then(() =>
				onSaveRef.current(
					pending.value,
					() => pending.version === versionRef.current,
				),
			);
	}, []);

	const schedule = useCallback(
		(value: T, immediate = false) => {
			versionRef.current += 1;
			pendingRef.current = { value, version: versionRef.current };
			if (timerRef.current) clearTimeout(timerRef.current);
			if (immediate) flush();
			else timerRef.current = setTimeout(flush, delay);
		},
		[delay, flush],
	);

	useEffect(() => flush, [flush]);
	return schedule;
}

interface SourceSaveRequest {
	scope: string;
	ignoreSourcesList: string[];
}

interface SimplifiedNotesSaveRequest {
	scope: string;
	enabled: boolean;
}

export function useSettingsModalController(
	onCancel: () => void,
	runtime: SettingsModalRuntime,
): SettingsModalViewProps {
	const currentLanguage = runtime.currentLanguage;
	const availableLanguages = runtime.availableLanguages;
	const currentTheme = runtime.currentTheme;
	const simplifiedNotesEnabled = runtime.simplifiedNotesEnabled;
	const storedCampaigns = runtime.storedCampaigns;
	const campaigns = useMemo(
		() => normalizeSettingsCampaigns(storedCampaigns),
		[storedCampaigns],
	);
	const activeCampaignSlug = runtime.activeCampaignSlug;
	const storedAiBasePrompt = runtime.storedAiBasePrompt || "";
	const storedImagePromptBasePrompt =
		runtime.storedImagePromptBasePrompt === undefined
			? DEFAULT_IMAGE_PROMPT_BASE_PROMPT
			: runtime.storedImagePromptBasePrompt;
	const storedCampaignAiBasePrompts = runtime.storedCampaignAiBasePrompts;
	const storedCampaignImagePromptBasePrompts =
		runtime.storedCampaignImagePromptBasePrompts;
	const storedIgnoreSourcesList = runtime.storedIgnoreSourcesList || [];
	const autoApplyAiChanges = runtime.autoApplyAiChanges !== false;
	const useSearchDebounce = runtime.useSearchDebounce !== false;
	const [aiBasePrompt, setAiBasePrompt] = useState(storedAiBasePrompt);
	const [imagePromptBasePrompt, setImagePromptBasePrompt] = useState(
		storedImagePromptBasePrompt,
	);
	const [campaignAiBasePrompts, setCampaignAiBasePrompts] =
		useState<SettingsPromptMap>(storedCampaignAiBasePrompts);
	const [campaignImagePromptBasePrompts, setCampaignImagePromptBasePrompts] =
		useState<SettingsPromptMap>(storedCampaignImagePromptBasePrompts);
	const [ignoreSourcesList, setIgnoreSourcesList] = useState(
		storedIgnoreSourcesList,
	);
	const [campaignIgnoreSourcesLists, setCampaignIgnoreSourcesLists] =
		useState<CampaignIgnoreSourcesMap>({});
	const [sourceOptions, setSourceOptions] = useState<string[]>([]);
	const [selectedPromptScope, setSelectedPromptScope] = useState(
		activeCampaignSlug || GLOBAL_SETTINGS_SCOPE,
	);
	const [selectedSourceScope, setSelectedSourceScope] = useState(
		activeCampaignSlug || GLOBAL_SETTINGS_SCOPE,
	);
	const [selectedNotesScope, setSelectedNotesScope] = useState(
		activeCampaignSlug || GLOBAL_SETTINGS_SCOPE,
	);
	const [notesStatus, setNotesStatus] = useState<SettingsSaveStatus>("idle");
	const [pendingSimplifiedNotes, setPendingSimplifiedNotes] = useState<
		Record<string, boolean>
	>({});
	const [promptStatus, setPromptStatus] =
		useState<SettingsSaveStatus>("idle");
	const [sourceStatus, setSourceStatus] =
		useState<SettingsSaveStatus>("idle");
	const [notification, setNotification] = useState<string | null>(null);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => setAiBasePrompt(storedAiBasePrompt), [storedAiBasePrompt]);
	useEffect(
		() => setImagePromptBasePrompt(storedImagePromptBasePrompt),
		[storedImagePromptBasePrompt],
	);
	useEffect(
		() => setCampaignAiBasePrompts(storedCampaignAiBasePrompts),
		[storedCampaignAiBasePrompts],
	);
	useEffect(
		() =>
			setCampaignImagePromptBasePrompts(
				storedCampaignImagePromptBasePrompts,
			),
		[storedCampaignImagePromptBasePrompts],
	);
	useEffect(
		() => setIgnoreSourcesList(storedIgnoreSourcesList),
		[storedIgnoreSourcesList],
	);
	useEffect(
		() => setCampaignIgnoreSourcesLists(buildCampaignIgnoreSourcesMap(campaigns)),
		[campaigns],
	);
	useEffect(() => {
		const loadSourceOptions = async () => {
			try {
				const [bestiarySources, spellSources] = await Promise.all([
					bestiaryApi.getBestiarySources(),
					spellApi.getSpellSources(),
				]);
				setSourceOptions(
					mergeContentSourceOptions(bestiarySources, spellSources),
				);
			} catch (error) {
				console.error("Failed to load content sources", error);
			}
		};
		loadSourceOptions();
	}, []);

	useSettingsScopeRecovery({
		selectedScope: selectedPromptScope,
		setSelectedScope: setSelectedPromptScope,
		activeCampaignSlug,
		campaigns,
	});
	useSettingsScopeRecovery({
		selectedScope: selectedSourceScope,
		setSelectedScope: setSelectedSourceScope,
		activeCampaignSlug,
		campaigns,
	});
	useSettingsScopeRecovery({
		selectedScope: selectedNotesScope,
		setSelectedScope: setSelectedNotesScope,
		activeCampaignSlug,
		campaigns,
	});

	const promptSelection = resolveSelectedPromptSettings({
		scope: selectedPromptScope,
		aiBasePrompt,
		imagePromptBasePrompt,
		campaignAiBasePrompts,
		campaignImagePromptBasePrompts,
	});
	const sourceSelection = resolveSelectedSourceSettings({
		scope: selectedSourceScope,
		ignoreSourcesList,
		campaignIgnoreSourcesLists,
	});
	const simplifiedNotesCampaigns = useMemo(
		() =>
			campaigns.map((campaign) =>
				Object.hasOwn(pendingSimplifiedNotes, campaign.slug)
					? {
							...campaign,
							simplifiedNotes: pendingSimplifiedNotes[campaign.slug],
						}
					: campaign,
			),
		[campaigns, pendingSimplifiedNotes],
	);
	const simplifiedNotesSelection = resolveSelectedSimplifiedNotesSettings({
		scope: selectedNotesScope,
		simplifiedNotes: simplifiedNotesEnabled,
		campaigns: simplifiedNotesCampaigns,
	});
	const selectedSources = useMemo(
		() =>
			getSelectedSourcesFromIgnoreList(
				sourceOptions,
				sourceSelection.ignoreSourcesList,
			),
		[sourceOptions, sourceSelection.ignoreSourcesList],
	);

	const patchSettings = async (payload: Record<string, unknown>) => {
		try {
			await settingsApi.updateSettings(payload);
		} catch (error) {
			console.error("Failed to save settings", error);
		}
	};
	const handleThemeToggle = () => {
		const nextTheme = getNextTheme(currentTheme);
		runtime.patchUiSettings({ theme: nextTheme });
		patchSettings({ theme: nextTheme });
	};
	const handleLanguageChange = (language: string) => {
		runtime.setLanguage(language);
		patchSettings({ language });
	};
	const handleAutoApplyAiChangesChange = (enabled: boolean) => {
		runtime.patchUiSettings({ autoApplyAiChanges: enabled });
		patchSettings({ autoApplyAiChanges: enabled });
	};
	const handleUseSearchDebounceChange = (enabled: boolean) => {
		runtime.patchUiSettings({ useSearchDebounce: enabled });
		patchSettings({ useSearchDebounce: enabled });
	};
	const schedulePromptSave = useQueuedAutosave({
		onSave: async (payload: ReturnType<typeof buildPromptSettingsPayload>, isLatest) => {
			if (isLatest() && isMountedRef.current) setPromptStatus("saving");
			try {
				const saved = await settingsApi.updateSettings(payload);
				if (!saved) throw new Error("Settings response is empty");
				if (!isLatest()) return;
				const nextUiSettings = normalizeSavedPromptSettings(saved);
				runtime.patchUiSettings(nextUiSettings);
				if (!isMountedRef.current) return;
				setAiBasePrompt(nextUiSettings.aiBasePrompt);
				setImagePromptBasePrompt(nextUiSettings.imagePromptBasePrompt);
				setCampaignAiBasePrompts(nextUiSettings.campaignAiBasePrompts);
				setCampaignImagePromptBasePrompts(
					nextUiSettings.campaignImagePromptBasePrompts,
				);
			} catch (error) {
				console.error("Failed to save AI base prompts", error);
				if (isLatest() && isMountedRef.current) {
					setNotification(lang.t("Failed to save prompts"));
				}
			} finally {
				if (isLatest() && isMountedRef.current) setPromptStatus("idle");
			}
		},
	});
	const scheduleSourceSave = useQueuedAutosave<SourceSaveRequest>({
		onSave: async ({ scope, ignoreSourcesList: nextIgnoreSourcesList }, isLatest) => {
			if (isLatest() && isMountedRef.current) setSourceStatus("saving");
			try {
				if (scope === GLOBAL_SETTINGS_SCOPE) {
					const saved = await settingsApi.updateSettings({
						ignoreSourcesList: nextIgnoreSourcesList,
					});
					if (!saved) throw new Error("Settings response is empty");
					if (!isLatest()) return;
					const savedIgnoreSourcesList = normalizeSavedIgnoreSources(saved);
					runtime.patchUiSettings({
						ignoreSourcesList: savedIgnoreSourcesList,
					});
					if (isMountedRef.current) {
						setIgnoreSourcesList(savedIgnoreSourcesList);
					}
				} else {
					await campaignApi.updateCampaign(scope, {
						ignoreSourcesList: nextIgnoreSourcesList,
					});
					const nextCampaigns = await campaignApi.listCampaigns();
					if (isLatest()) {
						runtime.setCampaigns(normalizeSettingsCampaigns(nextCampaigns));
					}
				}
			} catch (error) {
				console.error("Failed to save source settings", error);
				if (isLatest() && isMountedRef.current) {
					setNotification(lang.t("Failed to save source settings"));
				}
			} finally {
				if (isLatest() && isMountedRef.current) setSourceStatus("idle");
			}
		},
	});
	const scheduleSimplifiedNotesSave =
		useQueuedAutosave<SimplifiedNotesSaveRequest>({
			onSave: async ({ scope, enabled }, isLatest) => {
				if (isLatest() && isMountedRef.current) setNotesStatus("saving");
				try {
					if (scope === GLOBAL_SETTINGS_SCOPE) {
						const saved = await settingsApi.updateSettings({
							simplifiedNotes: enabled,
						});
						if (!saved) throw new Error("Settings response is empty");
						if (isLatest()) {
							runtime.patchUiSettings({
								simplifiedNotes: Boolean(saved.simplifiedNotes),
							});
						}
					} else {
						await campaignApi.updateCampaign(scope, {
							simplifiedNotes: enabled,
						});
						const nextCampaigns = await campaignApi.listCampaigns();
						if (isLatest()) {
							runtime.setCampaigns(
								normalizeSettingsCampaigns(nextCampaigns),
							);
						}
						if (isMountedRef.current) {
							setPendingSimplifiedNotes((current) => {
								const next = { ...current };
								delete next[scope];
								return next;
							});
						}
					}
				} catch (error) {
					console.error("Failed to save simplified notes setting", error);
					if (isLatest() && isMountedRef.current) {
						setNotification(
							lang.t("Failed to save simplified notes setting"),
						);
					}
					if (scope !== GLOBAL_SETTINGS_SCOPE) {
						if (isMountedRef.current) {
							setPendingSimplifiedNotes((current) => {
								const next = { ...current };
								delete next[scope];
								return next;
							});
						}
						try {
							const currentCampaigns = await campaignApi.listCampaigns();
							if (isLatest()) {
								runtime.setCampaigns(
									normalizeSettingsCampaigns(currentCampaigns),
								);
							}
						} catch (reloadError) {
							console.error("Failed to reload campaigns", reloadError);
						}
					}
				} finally {
					if (isLatest() && isMountedRef.current) setNotesStatus("idle");
				}
			},
		});
	const handleSimplifiedNotesChange = (enabled: boolean) => {
		if (simplifiedNotesSelection.isGlobalScope) {
			runtime.patchUiSettings({ simplifiedNotes: enabled });
		} else {
			setPendingSimplifiedNotes((current) => ({
				...current,
				[selectedNotesScope]: enabled,
			}));
			runtime.setCampaigns(
				setCampaignSimplifiedNotesSetting(
					campaigns,
					selectedNotesScope,
					enabled,
				),
			);
		}
		scheduleSimplifiedNotesSave(
			{ scope: selectedNotesScope, enabled },
			true,
		);
	};
	const handleSelectedBasePromptChange = (value: string) => {
		const nextAiBasePrompt = promptSelection.isGlobalScope
			? value
			: aiBasePrompt;
		const nextCampaignAiBasePrompts = promptSelection.isGlobalScope
			? campaignAiBasePrompts
			: setSettingsPromptForScope(
					campaignAiBasePrompts,
					selectedPromptScope,
					value,
				);
		setAiBasePrompt(nextAiBasePrompt);
		setCampaignAiBasePrompts(nextCampaignAiBasePrompts);
		const payload = buildPromptSettingsPayload({
			aiBasePrompt: nextAiBasePrompt,
			imagePromptBasePrompt,
			campaignAiBasePrompts: nextCampaignAiBasePrompts,
			campaignImagePromptBasePrompts,
		});
		runtime.patchUiSettings(payload);
		schedulePromptSave(payload);
	};
	const handleSelectedImagePromptChange = (value: string) => {
		const nextImagePromptBasePrompt = promptSelection.isGlobalScope
			? value
			: imagePromptBasePrompt;
		const nextCampaignImagePromptBasePrompts = promptSelection.isGlobalScope
			? campaignImagePromptBasePrompts
			: setSettingsPromptForScope(
					campaignImagePromptBasePrompts,
					selectedPromptScope,
					value,
				);
		setImagePromptBasePrompt(nextImagePromptBasePrompt);
		setCampaignImagePromptBasePrompts(nextCampaignImagePromptBasePrompts);
		const payload = buildPromptSettingsPayload({
			aiBasePrompt,
			imagePromptBasePrompt: nextImagePromptBasePrompt,
			campaignAiBasePrompts,
			campaignImagePromptBasePrompts: nextCampaignImagePromptBasePrompts,
		});
		runtime.patchUiSettings(payload);
		schedulePromptSave(payload);
	};
	const handleSelectedSourcesChange = (nextSelectedSources: string[]) => {
		const nextIgnoreSourcesList = getIgnoreSourcesListFromSelectedSources(
			sourceOptions,
			nextSelectedSources,
		);
		if (sourceSelection.isGlobalScope) {
			setIgnoreSourcesList(nextIgnoreSourcesList);
			runtime.patchUiSettings({ ignoreSourcesList: nextIgnoreSourcesList });
		} else {
			setCampaignIgnoreSourcesLists(
				setCampaignIgnoreSourcesForScope(
					campaignIgnoreSourcesLists,
					selectedSourceScope,
					nextIgnoreSourcesList,
				),
			);
		}
		scheduleSourceSave({
			scope: selectedSourceScope,
			ignoreSourcesList: nextIgnoreSourcesList,
		});
	};
	const handleUseGlobalSources = () => {
		if (sourceSelection.isGlobalScope || !selectedSourceScope) return;
		const nextIgnoreSourcesList = normalizeIgnoreSourcesList(ignoreSourcesList);
		setCampaignIgnoreSourcesLists(
			setCampaignIgnoreSourcesForScope(
				campaignIgnoreSourcesLists,
				selectedSourceScope,
				nextIgnoreSourcesList,
			),
		);
		scheduleSourceSave(
			{
				scope: selectedSourceScope,
				ignoreSourcesList: nextIgnoreSourcesList,
			},
			true,
		);
	};

	return {
		notification,
		onNotificationClose: () => setNotification(null),
		onCancel,
		general: {
			campaigns,
			selectedScope: selectedNotesScope,
			isInherited: simplifiedNotesSelection.isInherited,
			status: notesStatus,
			currentTheme,
			currentLanguage,
			availableLanguages,
			simplifiedNotesEnabled: simplifiedNotesSelection.enabled,
			useSearchDebounce,
			onThemeToggle: handleThemeToggle,
			onLanguageChange: handleLanguageChange,
			onScopeChange: setSelectedNotesScope,
			onSimplifiedNotesChange: handleSimplifiedNotesChange,
			onUseSearchDebounceChange: handleUseSearchDebounceChange,
		},
		sources: {
			campaigns,
			selectedScope: selectedSourceScope,
			isGlobalScope: sourceSelection.isGlobalScope,
			status: sourceStatus,
			options: sourceOptions,
			selectedSources,
			onScopeChange: setSelectedSourceScope,
			onSelectedSourcesChange: handleSelectedSourcesChange,
			onUseGlobal: handleUseGlobalSources,
		},
		ai: {
			campaigns,
			selectedScope: selectedPromptScope,
			isGlobalScope: promptSelection.isGlobalScope,
			status: promptStatus,
			autoApplyAiChanges,
			basePrompt: promptSelection.basePrompt,
			imagePrompt: promptSelection.imagePrompt,
			onScopeChange: setSelectedPromptScope,
			onAutoApplyAiChangesChange: handleAutoApplyAiChangesChange,
			onBasePromptChange: handleSelectedBasePromptChange,
			onImagePromptChange: handleSelectedImagePromptChange,
		},
	};
}
