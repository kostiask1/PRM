import { useEffect, useMemo, useRef, useState } from "react";
import {
	aiApi,
	buildDiffResources,
	getHistoryChangeSummary,
	getLocalizedDiffResourceState,
	type AiHistoryEntry,
	type AiHistoryResource,
	type DiffResource,
} from "../../../../features/ai/index.js";
import type {
	AiResponseHistoryEntry,
	AiResponseModalComponent,
} from "../../../../features/ai/ui/index.js";
import { Modal } from "../../../../shared/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { formatActionCardTitle } from "../model/aiChatLocalization.ts";
import type { AiActionCard } from "../model/aiChatTypes.ts";

interface AiDiffPreviewModalV2Props {
	card: AiActionCard | null;
	campaignSlug: string;
	ResponseModal?: AiResponseModalComponent;
	isBusy?: boolean;
	onClose: () => void;
	onApply: (cardId: string, options?: { useDraftSnapshot?: boolean }) => void;
	onUndo?: (cardId: string) => void;
	onSaveDraftResources?: (
		cardId: string,
		resources: AiHistoryResource[],
	) => Promise<AiHistoryEntry | null>;
}

const NOOP_MARKDOWN_COMPONENTS = {};

export default function AiDiffPreviewModalV2({
	card,
	campaignSlug,
	ResponseModal,
	isBusy = false,
	onClose,
	onApply,
	onUndo,
	onSaveDraftResources,
}: AiDiffPreviewModalV2Props) {
	const [loadedResources, setLoadedResources] = useState<AiHistoryResource[] | null>(null);
	const generatedPromptRef = useRef<HTMLDivElement | null>(null);
	const didEditDraftRef = useRef(false);

	useEffect(() => {
		didEditDraftRef.current = false;
		setLoadedResources(null);
		if (!card || (card.diffResources && card.diffResources.length > 0)) {
			return;
		}
		if (!card.aiResponseId || !campaignSlug) return;

		let active = true;
		aiApi
			.listAiResponses(campaignSlug)
			.then((entries) => {
				if (!active || !Array.isArray(entries)) return;
				const match = entries.find(
					(item) => String(item?.id ?? "") === String(card.aiResponseId),
				);
				if (Array.isArray(match?.changes?.resources)) {
					setLoadedResources(match.changes.resources);
				}
			})
			.catch(() => {
				// Fallback to text diffSnippet when history fetch fails
			});

		return () => {
			active = false;
		};
	}, [card, campaignSlug]);

	const rawResources = useMemo<AiHistoryResource[]>(() => {
		if (!card) return [];
		if (card.diffResources && card.diffResources.length > 0) {
			return card.diffResources;
		}
		return loadedResources || [];
	}, [card, loadedResources]);

	const selectedResponseEntry = useMemo<AiResponseHistoryEntry | null>(() => {
		if (!card) return null;
		const applyState =
			card.status === "applied"
				? "applied"
				: card.status === "undone"
					? "undone"
					: "draft";
		return {
			id: card.aiResponseId || card.id,
			status: "completed",
			applyState,
			text: card.description || card.title,
			userInstructions: card.title,
			path: { campaign: campaignSlug },
			changes: { resources: rawResources },
		};
	}, [card, campaignSlug, rawResources]);

	const diffResources = useMemo<DiffResource[]>(
		() => buildDiffResources(selectedResponseEntry),
		[selectedResponseEntry],
	);

	if (!card) return null;

	const useRichModal = Boolean(ResponseModal && diffResources.length > 0);
	if (useRichModal && ResponseModal) {
		const initialSerialized = JSON.stringify(
			rawResources.map(({ id, after }) => ({ id, after })),
		);

		const handleSaveDraftChanges = async (
			resources: AiHistoryResource[],
		): Promise<AiResponseHistoryEntry | null | undefined> => {
			const nextSerialized = JSON.stringify(
				resources.map(({ id, after }) => ({ id, after })),
			);
			if (nextSerialized === initialSerialized) {
				didEditDraftRef.current = false;
				return selectedResponseEntry;
			}
			if (onSaveDraftResources && card.aiResponseId) {
				const saved = await onSaveDraftResources(card.id, resources);
				if (saved) {
					didEditDraftRef.current = true;
					return saved as AiResponseHistoryEntry;
				}
			}
			didEditDraftRef.current = false;
			return selectedResponseEntry;
		};

		const handleApply = () => {
			if (card.status === "applied") return;
			onApply(card.id, { useDraftSnapshot: didEditDraftRef.current });
		};

		const handleUndo = () => {
			if (card.status !== "applied") return;
			onUndo?.(card.id);
		};

		return (
			<ResponseModal
				generatedPrompt={card.description || formatActionCardTitle(card.title)}
				generatedPromptRef={generatedPromptRef}
				isGeneratedPromptCopied={false}
				isRestoringResponse={isBusy}
				markdownComponents={NOOP_MARKDOWN_COMPONENTS}
				onApply={handleApply}
				onApplyResource={async () => {}}
				onCancel={onClose}
				onCopy={() => {}}
				onSaveDraftChanges={handleSaveDraftChanges}
				onUndo={handleUndo}
				onUndoResource={async () => {}}
				selectedResponseDetails={[]}
				selectedResponseDiffResources={diffResources}
				selectedResponseEntry={selectedResponseEntry}
				selectedResponseHasChanges={true}
				getDiffResourceState={(resource) => getLocalizedDiffResourceState(resource)}
				getHistoryChangeSummary={(entry) =>
					getHistoryChangeSummary(entry) || formatActionCardTitle(card.title)
				}
			/>
		);
	}

	const beforeText = card.diffSnippet?.before || lang.t("Original text is missing or empty.");
	const afterText = card.diffSnippet?.after || card.description || lang.t("Proposed changes content.");

	return (
		<Modal
			title={card.title ? formatActionCardTitle(card.title) : lang.t("Compare changes (Diff)")}
			className="AiDiffFallbackModalV2"
			onConfirm={() => {}}
			onCancel={onClose}
			showFooter={false}
			cancelDisabled={isBusy}
		>
			<div className="AiDiffModalV2__body">
				<div className="AiDiffModalV2__columns">
					<div className="AiDiffModalV2__column AiDiffModalV2__column--before">
						<div className="AiDiffModalV2__columnHeader">
							<span className="AiDiffModalV2__tag">{lang.t("Current state")}</span>
							{card.targetEntity && (
								<span className="AiDiffModalV2__target">{card.targetEntity}</span>
							)}
						</div>
						<pre className="AiDiffModalV2__codeBlock">{beforeText}</pre>
					</div>

					<div className="AiDiffModalV2__column AiDiffModalV2__column--after">
						<div className="AiDiffModalV2__columnHeader">
							<span className="AiDiffModalV2__tag AiDiffModalV2__tag--after">{lang.t("AI proposal")}</span>
							{card.targetEntity && (
								<span className="AiDiffModalV2__target">{card.targetEntity}</span>
							)}
						</div>
						<pre className="AiDiffModalV2__codeBlock">{afterText}</pre>
					</div>
				</div>
			</div>

			<div className="AiDiffModalV2__footer">
				<button
					type="button"
					className="AiDiffModalV2__btn AiDiffModalV2__btn--ghost"
					onClick={onClose}
					disabled={isBusy}
				>
					{lang.t("Close")}
				</button>
				{card.status === "applied" ? (
					onUndo && card.aiResponseId ? (
						<button
							type="button"
							className="AiDiffModalV2__btn AiDiffModalV2__btn--ghost"
							onClick={() => onUndo(card.id)}
							disabled={isBusy}
						>
							{lang.t("Undo these changes")}
						</button>
					) : null
				) : (
					<button
						type="button"
						className="AiDiffModalV2__btn AiDiffModalV2__btn--primary"
						onClick={() => onApply(card.id)}
						disabled={isBusy}
					>
						{lang.t("Apply these changes")}
					</button>
				)}
			</div>
		</Modal>
	);
}
