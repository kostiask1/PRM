import type {
	AiAttachmentStateSetter,
	AiModelOption,
	AiUiAttachment,
} from "../../../features/ai/ui/index.js";
import { Modal } from "../../../features/modal/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	getImagePromptPickerState,
	type ImagePromptEntity,
	type ImagePromptTarget,
} from "../model/imagePromptPicker.ts";
import AiImagePromptDetails from "./AiImagePromptDetails.tsx";
import AiImagePromptSelection from "./AiImagePromptSelection.tsx";

export interface AiImagePromptPickerModalProps {
	attachedFiles: AiUiAttachment[];
	attachedImages: AiUiAttachment[];
	buildCustomMonsterImageTarget: (
		monster: ImagePromptEntity,
	) => ImagePromptTarget;
	buildLocationImageTarget: (
		location: ImagePromptEntity,
	) => ImagePromptTarget;
	buildNpcImageTarget: (npc: ImagePromptEntity) => ImagePromptTarget;
	buildSceneImageTarget: (scene: ImagePromptEntity) => ImagePromptTarget;
	campaignSlug?: string | null;
	customMonstersWithImages: ImagePromptEntity[];
	customMonstersWithoutImages: ImagePromptEntity[];
	getCharacterDisplayName: (character: ImagePromptEntity) => string;
	getImagePromptPreview: (description: unknown) => string;
	getImagePromptTargetTitle: (target: ImagePromptTarget) => string;
	getLocationDisplayName: (location: ImagePromptEntity) => string;
	getSceneImagePromptDescription: (scene: ImagePromptEntity) => unknown;
	getSceneImagePromptTitle: (
		scene: ImagePromptEntity,
		index: number,
	) => string;
	imagePromptInstructions: string;
	imagePromptLocations: ImagePromptEntity[];
	imagePromptNpcs: ImagePromptEntity[];
	imagePromptRequest: string;
	imagePromptScenes: ImagePromptEntity[];
	aiModels?: AiModelOption[] | null;
	isBestiary: boolean;
	isCampaign: boolean;
	isContextMode: boolean;
	isDataLoading: boolean;
	isOpen: boolean;
	loading: boolean;
	onBackToSelection: () => void;
	onCancel: () => void;
	onContinueWithoutSelection: () => void;
	onGenerate: (target: ImagePromptTarget | null) => unknown;
	onInstructionsChange: (value: string) => void;
	onModelChange: (value: string) => void;
	onRequestChange: (value: string) => void;
	onSelectTarget: (target: ImagePromptTarget) => void;
	selectedModel: string;
	selectedTarget?: ImagePromptTarget | null;
	setAttachedFiles: AiAttachmentStateSetter;
	setAttachedImages: AiAttachmentStateSetter;
}

export default function AiImagePromptPickerModal({
	attachedFiles,
	attachedImages,
	buildCustomMonsterImageTarget,
	buildLocationImageTarget,
	buildNpcImageTarget,
	buildSceneImageTarget,
	campaignSlug,
	customMonstersWithImages,
	customMonstersWithoutImages,
	getCharacterDisplayName,
	getImagePromptPreview,
	getImagePromptTargetTitle,
	getLocationDisplayName,
	getSceneImagePromptDescription,
	getSceneImagePromptTitle,
	imagePromptInstructions,
	imagePromptLocations,
	imagePromptNpcs,
	imagePromptRequest,
	imagePromptScenes,
	aiModels,
	isBestiary,
	isCampaign,
	isContextMode,
	isDataLoading,
	isOpen,
	loading,
	onBackToSelection,
	onCancel,
	onContinueWithoutSelection,
	onGenerate,
	onInstructionsChange,
	onModelChange,
	onRequestChange,
	onSelectTarget,
	selectedModel,
	selectedTarget = null,
	setAttachedFiles,
	setAttachedImages,
}: AiImagePromptPickerModalProps) {
	if (!isOpen) return null;

	const state = getImagePromptPickerState({
		selectedTarget,
		isContextMode,
		loading,
		request: imagePromptRequest,
	});
	const modelOptions = Array.isArray(aiModels) ? aiModels : [];

	return (
		<Modal
			title={lang.t(state.titleKey)}
			onConfirm={() => {}}
			onCancel={onCancel}
			showFooter={false}
			className="AiAssistant__image_prompt_modal"
			cancelDisabled={loading}
		>
			{state.isDetailsVisible ? (
				<AiImagePromptDetails
					attachedFiles={attachedFiles}
					attachedImages={attachedImages}
					campaignSlug={campaignSlug}
					aiModels={modelOptions}
					loading={loading}
					canGenerate={state.canGenerate}
					isContextMode={isContextMode}
					imagePromptRequest={imagePromptRequest}
					imagePromptInstructions={imagePromptInstructions}
					selectedModel={selectedModel}
					selectedTarget={selectedTarget}
					getImagePromptTargetTitle={getImagePromptTargetTitle}
					onBackToSelection={onBackToSelection}
					onGenerate={onGenerate}
					onInstructionsChange={onInstructionsChange}
					onModelChange={onModelChange}
					onRequestChange={onRequestChange}
					setAttachedFiles={setAttachedFiles}
					setAttachedImages={setAttachedImages}
				/>
			) : (
				<AiImagePromptSelection
					buildCustomMonsterImageTarget={buildCustomMonsterImageTarget}
					buildLocationImageTarget={buildLocationImageTarget}
					buildNpcImageTarget={buildNpcImageTarget}
					buildSceneImageTarget={buildSceneImageTarget}
					customMonstersWithImages={customMonstersWithImages}
					customMonstersWithoutImages={customMonstersWithoutImages}
					getCharacterDisplayName={getCharacterDisplayName}
					getImagePromptPreview={getImagePromptPreview}
					getLocationDisplayName={getLocationDisplayName}
					getSceneImagePromptDescription={getSceneImagePromptDescription}
					getSceneImagePromptTitle={getSceneImagePromptTitle}
					imagePromptLocations={imagePromptLocations}
					imagePromptNpcs={imagePromptNpcs}
					imagePromptScenes={imagePromptScenes}
					isBestiary={isBestiary}
					isCampaign={isCampaign}
					isDataLoading={isDataLoading}
					loading={loading}
					onContinueWithoutSelection={onContinueWithoutSelection}
					onSelectTarget={onSelectTarget}
				/>
			)}
		</Modal>
	);
}
