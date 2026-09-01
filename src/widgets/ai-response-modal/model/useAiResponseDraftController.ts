import { useEffect, useMemo, useState } from "react";

import type {
	AiResponseHistoryEntry,
	AiResponseModalProps,
} from "../../../features/ai/ui/index.js";
import {
	findDraftResourceForPreview,
	getEditedPreviewResource,
	getHistoryResourceId,
	parseSnapshotText,
	snapshotToText,
	updateDraftResourceCollection,
	type PreviewResource,
} from "./aiResponseModal.ts";

export type AiResponseDiffViewMode = "preview" | "json";

interface DraftControllerOptions {
	selectedResponseEntry: AiResponseHistoryEntry | null;
	onApply: AiResponseModalProps["onApply"];
	onApplyResource: AiResponseModalProps["onApplyResource"];
	onSaveDraftChanges: AiResponseModalProps["onSaveDraftChanges"];
	onUndoResource: AiResponseModalProps["onUndoResource"];
	invalidDraftMessage: string;
	emptyDraftMessage: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export function useAiResponseDraftController({
	selectedResponseEntry,
	onApply,
	onApplyResource,
	onSaveDraftChanges,
	onUndoResource,
	invalidDraftMessage,
	emptyDraftMessage,
}: DraftControllerOptions) {
	const draftResources = useMemo<PreviewResource[]>(
		() =>
			selectedResponseEntry?.applyState === "draft" &&
			Array.isArray(selectedResponseEntry.changes?.resources)
				? selectedResponseEntry.changes.resources
				: [],
		[selectedResponseEntry],
	);
	const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
	const [draftResourceEdits, setDraftResourceEdits] = useState<PreviewResource[]>([]);
	const [draftError, setDraftError] = useState("");
	const [diffViewMode, setDiffViewMode] =
		useState<AiResponseDiffViewMode>("preview");
	const isDraft = selectedResponseEntry?.applyState === "draft";

	useEffect(() => {
		setDraftEdits(
			Object.fromEntries(
				draftResources.map((resource) => [resource.id, snapshotToText(resource.after)]),
			),
		);
		setDraftResourceEdits(
			JSON.parse(JSON.stringify(draftResources)) as PreviewResource[],
		);
		setDraftError("");
	}, [draftResources]);

	useEffect(() => {
		setDiffViewMode("preview");
	}, [selectedResponseEntry?.id]);

	const resolvePreviewResource = (resource: PreviewResource): PreviewResource => {
		const draftResource = findDraftResourceForPreview(
			draftResourceEdits,
			resource,
			isDraft,
		);
		return getEditedPreviewResource(resource, draftResource);
	};

	const updateDraftResourceAfter = (
		resource: PreviewResource,
		nextSnapshot: unknown,
	): void => {
		if (!isDraft) return;
		setDraftResourceEdits((current) =>
			updateDraftResourceCollection(current, resource, nextSnapshot),
		);
	};

	const historyResourceId = (resource: PreviewResource): string => {
		const resources = Array.isArray(selectedResponseEntry?.changes?.resources)
			? selectedResponseEntry.changes.resources
			: [];
		return String(getHistoryResourceId(resources, resource));
	};

	const serializeDraftResources = () =>
		draftResourceEdits.map(({ id, after }) => ({ id, after }));

	const apply = async (): Promise<void> => {
		if (!isDraft || draftResources.length === 0) {
			await onApply(selectedResponseEntry);
			return;
		}
		try {
			setDraftError("");
			const updatedEntry = await onSaveDraftChanges(serializeDraftResources());
			await onApply(updatedEntry || selectedResponseEntry);
		} catch (error) {
			setDraftError(getErrorMessage(error, invalidDraftMessage));
		}
	};

	const applyResource = async (resource: PreviewResource): Promise<void> => {
		if (!isDraft) return;
		try {
			setDraftError("");
			const updatedEntry = await onSaveDraftChanges(serializeDraftResources());
			await onApplyResource(updatedEntry || selectedResponseEntry, [historyResourceId(resource)]);
		} catch (error) {
			setDraftError(getErrorMessage(error, invalidDraftMessage));
		}
	};

	const undoResource = async (resource: PreviewResource): Promise<void> => {
		await onUndoResource(selectedResponseEntry, [historyResourceId(resource)]);
	};

	const updateDraftText = (resource: PreviewResource, text: string): void => {
		setDraftEdits((current) => ({ ...current, [resource.id]: text }));
		try {
			const after = parseSnapshotText(text, resource.after === null, emptyDraftMessage);
			setDraftResourceEdits((current) =>
				current.map((item) => (item.id === resource.id ? { ...item, after } : item)),
			);
			setDraftError("");
		} catch {
			setDraftError(invalidDraftMessage);
		}
	};

	return {
		apply,
		applyResource,
		diffViewMode,
		draftEdits,
		draftError,
		draftResourceEdits,
		draftResources,
		isDraft,
		resolvePreviewResource,
		setDiffViewMode,
		undoResource,
		updateDraftResourceAfter,
		updateDraftText,
	};
}
