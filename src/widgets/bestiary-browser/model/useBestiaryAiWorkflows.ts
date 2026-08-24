import {
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import {
	aiApi,
	buildDiffResources,
	loadAiModelOptions,
	type AiHistoryEntry,
	type AiHistoryResource,
	type AiModelDescriptor,
} from "../../../features/ai/index.js";
import type { AiUiAttachment } from "../../../features/ai/ui/index.js";
import {
	type MonsterAiAction,
	type MonsterAiEditMode,
} from "../../../features/ai-edit-monster/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	executeAiDraftRestore,
	executeAiMonsterEditRequest,
	getAiDraftRestoreStartPlan,
	getAiMonsterEditStartPlan,
	getAiMonsterGenerationResultPlan,
	isCustomSource,
	preserveAiDraftResourceMetadata,
	shouldClearAiMonsterEditController,
	type AiBestiaryGenerationResult,
	type CustomBestiaryUpdateOptions,
} from "./bestiaryBrowser.ts";

interface Message {
	title: string;
	message: string;
}

interface Options {
	currentLanguage: string;
	customMonsters: BestiaryMonster[];
	onCustomBestiaryUpdate(
		updated: unknown,
		options?: CustomBestiaryUpdateOptions,
	): void;
	onOpenImagePrompt(monster: BestiaryMonster): void;
	onPushCustomUndoSnapshot(snapshot: BestiaryMonster[]): void;
	showMessage(message: Message): void;
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export function useBestiaryAiWorkflows({
	currentLanguage,
	customMonsters,
	onCustomBestiaryUpdate,
	onOpenImagePrompt,
	onPushCustomUndoSnapshot,
	showMessage,
}: Options) {
	const aiEditControllerRef = useRef<AbortController | null>(null);
	const [aiEditingMonster, setAiEditingMonster] =
		useState<BestiaryMonster | null>(null);
	const [aiEditMode, setAiEditMode] = useState<MonsterAiEditMode>("edit");
	const [aiActionMonster, setAiActionMonster] =
		useState<BestiaryMonster | null>(null);
	const [aiEditInstructions, setAiEditInstructions] = useState("");
	const [aiEditAttachedImages, setAiEditAttachedImages] = useState<
		AiUiAttachment[]
	>([]);
	const [aiEditAttachedFiles, setAiEditAttachedFiles] = useState<
		AiUiAttachment[]
	>([]);
	const [aiEditError, setAiEditError] = useState("");
	const [isAiEditingMonster, setIsAiEditingMonster] = useState(false);
	const [aiModels, setAiModels] = useState<AiModelDescriptor[]>([]);
	const [selectedAiModel, setSelectedAiModel] = useState("");
	const [aiDraftResponseEntry, setAiDraftResponseEntry] =
		useState<AiHistoryEntry | null>(null);
	const [isRestoringAiResponse, setIsRestoringAiResponse] = useState(false);
	const aiDraftDiffResources = useMemo(
		() =>
			buildDiffResources(aiDraftResponseEntry, {
				creature: lang.t("Creature"),
			}),
		[aiDraftResponseEntry],
	);

	useEffect(() => {
		return () => {
			aiEditControllerRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (!aiEditingMonster || aiModels.length > 0) return;
		loadAiModelOptions({
			setAiModels,
			setSelectedAiModel,
			onError: (error: unknown) => {
				console.error("Failed to load AI models", error);
				setAiEditError(
					getErrorMessage(error, lang.t("Failed to connect to AI.")),
				);
			},
		});
	}, [aiEditingMonster, aiModels.length]);

	const openAiEditCustomMonster = (
		monster: BestiaryMonster,
		mode: MonsterAiEditMode = "edit",
	) => {
		if (!monster?.name) return;
		if (mode === "edit" && !isCustomSource(monster.source)) {
			return;
		}
		setAiEditMode(mode);
		setAiEditingMonster(monster);
		setAiEditInstructions("");
		setAiEditAttachedImages([]);
		setAiEditAttachedFiles([]);
		setAiEditError("");
	};

	const closeAiEditCustomMonster = () => {
		if (isAiEditingMonster) return;
		setAiEditingMonster(null);
		setAiEditMode("edit");
		setAiEditInstructions("");
		setAiEditAttachedImages([]);
		setAiEditAttachedFiles([]);
		setAiEditError("");
	};

	const cancelAiEditCustomMonsterRequest = () => {
		aiEditControllerRef.current?.abort();
	};

	const openMonsterAiAction = (monster: BestiaryMonster) => {
		if (!monster?.name) return;
		setAiActionMonster(monster);
	};

	const closeMonsterAiAction = () => {
		if (isAiEditingMonster) return;
		setAiActionMonster(null);
	};

	const chooseMonsterAiAction = (mode: MonsterAiAction) => {
		if (!aiActionMonster) return;
		const target = aiActionMonster;
		setAiActionMonster(null);
		if (mode === "image-prompt") {
			onOpenImagePrompt(target);
			return;
		}
		openAiEditCustomMonster(target, mode);
	};

	const resetAiEditState = () => {
		setAiEditingMonster(null);
		setAiEditMode("edit");
		setAiEditInstructions("");
		setAiEditAttachedImages([]);
		setAiEditAttachedFiles([]);
	};

	const applyAiGenerationResult = (
		data: AiBestiaryGenerationResult,
		targetMonster: BestiaryMonster,
	) => {
		const plan = getAiMonsterGenerationResultPlan(
			data,
			targetMonster,
			aiEditMode,
		);
		if (plan.kind === "draft") {
			setAiDraftResponseEntry(plan.entry);
		} else if (plan.kind === "update") {
			onCustomBestiaryUpdate(plan.updated, plan.options);
		}
	};

	const saveAiEditedCustomMonster = async () => {
		const startPlan = getAiMonsterEditStartPlan({
			targetMonster: aiEditingMonster,
			mode: aiEditMode,
			rawInstructions: aiEditInstructions,
			createInstruction: lang.t(
				"Create a new custom creature based on the selected creature. Do not change the selected creature.",
			),
			selectedModel: selectedAiModel,
			attachedImages: aiEditAttachedImages,
			attachedFiles: aiEditAttachedFiles,
			language: currentLanguage,
		});
		if (startPlan.kind === "skip") return;
		if (startPlan.kind === "invalid") {
			setAiEditError(lang.t("Describe what to change."));
			return;
		}

		setIsAiEditingMonster(true);
		setAiEditError("");
		const controller = new AbortController();
		aiEditControllerRef.current = controller;
		await executeAiMonsterEditRequest({
			plan: startPlan,
			signal: controller.signal,
			fallbackError: lang.t("Unknown error"),
			generateAi: aiApi.generateAi,
			onApplied: applyAiGenerationResult,
			onReset: resetAiEditState,
			onError: setAiEditError,
			onSettled: () => {
				if (
					shouldClearAiMonsterEditController(
						aiEditControllerRef.current,
						controller,
					)
				) {
					aiEditControllerRef.current = null;
				}
				setIsAiEditingMonster(false);
			},
		});
	};

	const saveAiDraftResponseChanges = async (
		resources: AiHistoryResource[],
	): Promise<AiHistoryEntry | null> => {
		if (!aiDraftResponseEntry?.id) return null;
		const updatedEntry = await aiApi.updateAiResponse(
			"bestiary",
			aiDraftResponseEntry.id,
			{
				resources: preserveAiDraftResourceMetadata(
					resources,
					aiDraftResponseEntry.changes?.resources,
				),
			},
		);
		if (updatedEntry) {
			setAiDraftResponseEntry(updatedEntry);
		}
		return updatedEntry;
	};

	const restoreAiDraftResponse = async (
		entry: AiHistoryEntry | null = aiDraftResponseEntry,
		mode: "apply" | "undo" = "apply",
		options: { resourceIds?: string[] } = {},
	) => {
		const start = getAiDraftRestoreStartPlan(
			entry,
			mode,
			options.resourceIds,
			isRestoringAiResponse,
			customMonsters,
		);
		await executeAiDraftRestore({
			start,
			onBusy: setIsRestoringAiResponse,
			apply: (restoreEntry, payload) =>
				aiApi.applyAiResponse("bestiary", restoreEntry.id, payload),
			undo: (restoreEntry, payload) =>
				aiApi.undoAiResponse("bestiary", restoreEntry.id, payload),
			onEntry: setAiDraftResponseEntry,
			onUndoSnapshot: onPushCustomUndoSnapshot,
			onUpdate: onCustomBestiaryUpdate,
			onError: (error) => {
				showMessage({
					title: lang.t("AI history error"),
					message: getErrorMessage(error, lang.t("Unknown error")),
				});
			},
		});
	};

	const closeAiDraftResponse = () => {
		if (isRestoringAiResponse) return;
		setAiDraftResponseEntry(null);
	};

	return {
		aiActionMonster,
		aiDraftDiffResources,
		aiDraftResponseEntry,
		aiEditAttachedFiles,
		aiEditAttachedImages,
		aiEditError,
		aiEditInstructions,
		aiEditMode,
		aiEditingMonster,
		aiModels,
		cancelAiEditCustomMonsterRequest,
		chooseMonsterAiAction,
		closeAiDraftResponse,
		closeAiEditCustomMonster,
		closeMonsterAiAction,
		isAiEditingMonster,
		isRestoringAiResponse,
		openAiEditCustomMonster,
		openMonsterAiAction,
		restoreAiDraftResponse,
		saveAiDraftResponseChanges,
		saveAiEditedCustomMonster,
		selectedAiModel,
		setAiEditAttachedFiles,
		setAiEditAttachedImages,
		setAiEditInstructions,
		setSelectedAiModel,
	};
}
