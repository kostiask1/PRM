import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
	buildAiHistoryRestorePlan,
	upsertAiHistoryEntry,
	useAiHistoryCommands,
	type AiHistoryEntry,
	type AiHistoryRestoreResult,
} from "../../../features/ai/index.js";
import {
	getAiAssistantHistoryView,
	getAiHistoryDeleteConfirmation,
	getAiHistoryErrorMessage,
	getAiHistoryRestoreConfirmation,
	type AiAssistantHistoryLabels,
	type AiAssistantHistoryRoute,
} from "./assistantHistory.ts";

interface HistoryStats {
	bytes?: number;
}

interface HistoryDetailRow {
	label: string;
	value: ReactNode;
}

interface ApplyUpdatedOptions {
	entityTypes?: string[];
	trackUndo?: boolean;
	historyEntry?: AiHistoryEntry;
}

interface UseAiAssistantHistoryControllerOptions {
	historyCampaign: string;
	isOpen: boolean;
	route: AiAssistantHistoryRoute;
	isBestiary: boolean;
	isCampaign: boolean;
	currentLanguage: string;
	translate(phrase: string): string;
	listResponses(campaign: string): Promise<AiHistoryEntry[] | null>;
	getResponseStats(campaign: string): Promise<HistoryStats | null>;
	getDetails(entry: AiHistoryEntry | null, language: string): HistoryDetailRow[];
	confirm(copy: { title: string; message: string }): boolean | Promise<boolean>;
	alert(copy: { title: string; message: string }): void;
	applyUpdatedData(updated: unknown, options?: ApplyUpdatedOptions): boolean;
	requestReload(entityTypes: string[]): void;
	notify(message: string): void;
	labels: AiAssistantHistoryLabels;
}

const getEntryText = (entry: AiHistoryEntry | null): string | null =>
	typeof entry?.text === "string" ? entry.text : null;

export function useAiAssistantHistoryController({
	historyCampaign,
	isOpen,
	route,
	isBestiary,
	isCampaign,
	currentLanguage,
	translate,
	listResponses,
	getResponseStats,
	getDetails,
	confirm,
	alert,
	applyUpdatedData,
	requestReload,
	notify,
	labels,
}: UseAiAssistantHistoryControllerOptions) {
	const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
	const [selectedResponseId, setSelectedResponseId] = useState<
		AiHistoryEntry["id"] | null
	>(null);
	const [selectedResponseEntry, setSelectedResponseEntry] =
		useState<AiHistoryEntry | null>(null);
	const [responseHistory, setResponseHistory] = useState<AiHistoryEntry[]>([]);
	const [responseHistorySizeBytes, setResponseHistorySizeBytes] = useState(0);
	const [isGeneratedPromptCopied, setIsGeneratedPromptCopied] = useState(false);
	const generatedPromptRef = useRef<HTMLDivElement>(null);

	const refreshStats = useCallback(async () => {
		if (!historyCampaign) return;
		try {
			const stats = await getResponseStats(historyCampaign);
			setResponseHistorySizeBytes(Number(stats?.bytes) || 0);
		} catch (error) {
			console.error("Failed to load AI response history stats", error);
			setResponseHistorySizeBytes(0);
		}
	}, [getResponseStats, historyCampaign]);

	const closePrompt = useCallback(() => {
		setGeneratedPrompt(null);
		setSelectedResponseId(null);
		setSelectedResponseEntry(null);
		setIsGeneratedPromptCopied(false);
	}, []);

	const showPrompt = useCallback((response: unknown) => {
		const entry: AiHistoryEntry =
			response && typeof response === "object"
				? (response as AiHistoryEntry)
				: { id: "", text: response };
		setGeneratedPrompt(getEntryText(entry));
		setSelectedResponseId(entry.id || null);
		setSelectedResponseEntry(entry);
		setIsGeneratedPromptCopied(false);
	}, []);

	const copyPrompt = useCallback(async () => {
		if (!generatedPromptRef.current || !generatedPrompt) return;
		try {
			const data = [
				new ClipboardItem({
					"text/html": new Blob([generatedPromptRef.current.innerHTML], {
						type: "text/html",
					}),
					"text/plain": new Blob([generatedPrompt], { type: "text/plain" }),
				}),
			];
			await navigator.clipboard.write(data);
		} catch (error) {
			console.error("Failed to copy formatted text:", error);
			await navigator.clipboard.writeText(generatedPrompt);
		}
		setIsGeneratedPromptCopied(true);
		setTimeout(() => setIsGeneratedPromptCopied(false), 2000);
	}, [generatedPrompt]);

	useEffect(() => {
		if (!isOpen || !historyCampaign) return;
		let cancelled = false;
		Promise.all([
			listResponses(historyCampaign),
			getResponseStats(historyCampaign).catch((error) => {
				console.error("Failed to load AI response history stats", error);
				return null;
			}),
		])
			.then(([responses, stats]) => {
				if (cancelled) return;
				setResponseHistory(Array.isArray(responses) ? responses : []);
				setResponseHistorySizeBytes(Number(stats?.bytes) || 0);
			})
			.catch((error) => {
				if (!cancelled) console.error("Failed to load AI response history", error);
			});
		return () => {
			cancelled = true;
		};
	}, [getResponseStats, historyCampaign, isOpen, listResponses]);

	const upsertEntry = useCallback(
		(entry: AiHistoryEntry) => {
			if (!entry?.id) return;
			setResponseHistory((current) => upsertAiHistoryEntry(current, entry));
			void refreshStats();
			if (selectedResponseId === entry.id) {
				setSelectedResponseEntry(entry);
				setGeneratedPrompt(getEntryText(entry));
			}
		},
		[refreshStats, selectedResponseId],
	);

	const refreshAfterRestore = useCallback(
		(result: AiHistoryRestoreResult, entry: AiHistoryEntry) => {
			const plan = buildAiHistoryRestorePlan({
				result,
				fallbackEntry: entry,
				selectedResponseId,
				currentRoute: route,
				isBestiary,
				isCampaign,
			});
			if (plan.historyUpdate?.type === "replace") {
				setResponseHistory(plan.historyUpdate.responses);
				void refreshStats();
			} else if (plan.historyUpdate?.type === "upsert") {
				setResponseHistory((current) =>
					upsertAiHistoryEntry(current, plan.historyUpdate?.entry),
				);
				void refreshStats();
			}
			if (plan.updateSelection) {
				setSelectedResponseEntry(plan.nextEntry);
				setGeneratedPrompt(getEntryText(plan.nextEntry));
			}
			if (plan.applyDirectly) {
				applyUpdatedData(plan.updated, {
					entityTypes: plan.entityTypes,
					trackUndo: false,
					historyEntry: plan.nextEntry,
				});
			}
			if (plan.requestReload) requestReload(plan.entityTypes);
		},
		[
			applyUpdatedData,
			isBestiary,
			isCampaign,
			refreshStats,
			requestReload,
			route,
			selectedResponseId,
		],
	);

	const commands = useAiHistoryCommands({
		historyCampaign,
		confirmDelete: () => confirm(getAiHistoryDeleteConfirmation("entry", translate)),
		confirmClear: () => confirm(getAiHistoryDeleteConfirmation("all", translate)),
		confirmRestore: (_entry, mode) =>
			confirm(getAiHistoryRestoreConfirmation(mode, translate)),
		onHistoryReplaced: setResponseHistory,
		onHistoryChanged: refreshStats,
		onEntryDeleted: (entry) => {
			if (selectedResponseId === entry.id) closePrompt();
		},
		onHistoryCleared: closePrompt,
		onEntryUpserted: upsertEntry,
		onDraftSaved: (entry) => {
			setSelectedResponseEntry(entry);
			setGeneratedPrompt(getEntryText(entry));
		},
		onRestored: (result, entry, { isUndo }) => {
			refreshAfterRestore(result, entry);
			notify(
				isUndo
					? translate("AI changes undone.")
					: translate("AI changes applied successfully!"),
			);
		},
		onError: (command, error) => {
			alert({
				title:
					command === "delete"
						? translate("Delete error")
						: translate("AI history error"),
				message: getAiHistoryErrorMessage(error, translate("Unknown error")),
			});
		},
	});

	const view = useMemo(
		() =>
			getAiAssistantHistoryView({
				entries: responseHistory,
				selectedEntry: selectedResponseEntry,
				route,
				isBestiary,
				labels,
			}),
		[isBestiary, labels, responseHistory, route, selectedResponseEntry],
	);

	return {
		...commands,
		...view,
		generatedPrompt,
		generatedPromptRef,
		isGeneratedPromptCopied,
		responseHistorySizeBytes,
		selectedResponseEntry,
		selectedResponseId,
		selectedResponseDetails: getDetails(
			selectedResponseEntry,
			currentLanguage,
		),
		closePrompt,
		copyPrompt,
		setResponseHistory,
		showPrompt,
		upsertEntry,
		refreshStats,
	};
}
