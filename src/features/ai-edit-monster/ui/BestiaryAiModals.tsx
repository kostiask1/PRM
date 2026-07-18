import type { Dispatch, SetStateAction } from "react";

import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import type {
	AiHistoryEntry,
	AiHistoryResource,
	AiModelDescriptor,
} from "../../ai/api/aiApi.ts";
import type { DiffResource } from "../../ai/model/aiDiff.ts";
import type { AiUiAttachment } from "../../ai/ui/index.js";
import type { MonsterAiEditMode } from "../model.ts";
import BestiaryAiDraftModal, {
	type AiDraftHistoryEntry,
	type BestiaryAiDraftModalProps,
} from "./BestiaryAiDraftModal.tsx";
import MonsterAiEditModal from "./MonsterAiEditModal.tsx";

export interface BestiaryAiModalsProps {
	ResponseModal: BestiaryAiDraftModalProps["ResponseModal"];
	aiDraftDiffResources: DiffResource[];
	aiDraftResponseEntry?: AiDraftHistoryEntry | null;
	aiDraftResponseRef: BestiaryAiDraftModalProps["aiDraftResponseRef"];
	aiEditAttachedFiles?: AiUiAttachment[];
	aiEditAttachedImages?: AiUiAttachment[];
	aiEditingMonster?: BestiaryMonster | null;
	aiEditError?: string | null;
	aiEditInstructions: string;
	aiEditMode: MonsterAiEditMode;
	aiModels: AiModelDescriptor[];
	getDiffResourceState: (resource: AiHistoryResource) => string;
	getHistoryChangeSummary: (entry: AiHistoryEntry) => string;
	isAiEditingMonster: boolean;
	isRestoringAiResponse: boolean;
	onApplyDraft: BestiaryAiDraftModalProps["onApply"];
	onApplyDraftResource: BestiaryAiDraftModalProps["onApplyResource"];
	onCancelDraft: () => void;
	onCancelEdit: () => void;
	onCancelEditRequest: () => void;
	onInstructionsChange: (value: string) => void;
	onModelChange: (value: string) => void;
	onSaveDraftChanges: (
		resources: AiHistoryResource[],
	) => Promise<AiDraftHistoryEntry | null | undefined>;
	onSaveEdit: () => void;
	onUndoDraft: BestiaryAiDraftModalProps["onUndo"];
	onUndoDraftResource: BestiaryAiDraftModalProps["onUndoResource"];
	selectedAiModel: string;
	setAiEditAttachedFiles?: Dispatch<SetStateAction<AiUiAttachment[]>>;
	setAiEditAttachedImages?: Dispatch<SetStateAction<AiUiAttachment[]>>;
}

export default function BestiaryAiModals({
	ResponseModal,
	aiDraftDiffResources,
	aiDraftResponseEntry,
	aiDraftResponseRef,
	aiEditAttachedFiles,
	aiEditAttachedImages,
	aiEditingMonster,
	aiEditError,
	aiEditInstructions,
	aiEditMode,
	aiModels,
	getDiffResourceState,
	getHistoryChangeSummary,
	isAiEditingMonster,
	isRestoringAiResponse,
	onApplyDraft,
	onApplyDraftResource,
	onCancelDraft,
	onCancelEdit,
	onCancelEditRequest,
	onInstructionsChange,
	onModelChange,
	onSaveDraftChanges,
	onSaveEdit,
	onUndoDraft,
	onUndoDraftResource,
	selectedAiModel,
	setAiEditAttachedFiles,
	setAiEditAttachedImages,
}: BestiaryAiModalsProps) {
	return (
		<>
			<MonsterAiEditModal
				aiEditingMonster={aiEditingMonster}
				aiEditError={aiEditError}
				attachedFiles={aiEditAttachedFiles}
				attachedImages={aiEditAttachedImages}
				aiEditInstructions={aiEditInstructions}
				aiEditMode={aiEditMode}
				aiModels={aiModels}
				isAiEditingMonster={isAiEditingMonster}
				onCancel={onCancelEdit}
				onCancelRequest={onCancelEditRequest}
				onInstructionsChange={onInstructionsChange}
				onModelChange={onModelChange}
				onSave={onSaveEdit}
				selectedAiModel={selectedAiModel}
				setAttachedFiles={setAiEditAttachedFiles}
				setAttachedImages={setAiEditAttachedImages}
			/>
			<BestiaryAiDraftModal
				ResponseModal={ResponseModal}
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraftResponseEntry}
				aiDraftResponseRef={aiDraftResponseRef}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isRestoringAiResponse={isRestoringAiResponse}
				onApply={onApplyDraft}
				onApplyResource={onApplyDraftResource}
				onCancel={onCancelDraft}
				onSaveDraftChanges={onSaveDraftChanges}
				onUndo={onUndoDraft}
				onUndoResource={onUndoDraftResource}
			/>
		</>
	);
}
