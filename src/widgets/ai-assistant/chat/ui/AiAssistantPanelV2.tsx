import { useState, type FormEvent } from "react";
import type { AiResponseModalComponent } from "../../../../features/ai/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import {
	formatCompactContextFeedback,
	getLocalizedChatTitle,
} from "../model/aiChatLocalization.ts";
import type { useAiChatState } from "../model/useAiChatState.ts";
import AiAssistantHeaderV2 from "./AiAssistantHeaderV2.tsx";
import AiContextAnchorBarV2 from "./AiContextAnchorBarV2.tsx";
import AiChatMessagesListV2 from "./AiChatMessagesListV2.tsx";
import AiChatComposerV2 from "./AiChatComposerV2.tsx";
import AiChatHistoryDropdownV2 from "./popovers/AiChatHistoryDropdownV2.tsx";
import AiContextSettingsPopoverV2 from "./popovers/AiContextSettingsPopoverV2.tsx";
import AiCommandsInfoTooltipV2 from "./popovers/AiCommandsInfoTooltipV2.tsx";
import AiModelSelectorDropdownV2 from "./popovers/AiModelSelectorDropdownV2.tsx";
import AiImageGeneratorPopoverV2 from "./popovers/AiImageGeneratorPopoverV2.tsx";
import AiDiffPreviewModalV2 from "./AiDiffPreviewModalV2.tsx";

interface AiAssistantPanelV2Props {
	state: ReturnType<typeof useAiChatState>;
	onClose: () => void;
	className?: string;
	ResponseModal?: AiResponseModalComponent;
}

export default function AiAssistantPanelV2({
	state,
	onClose,
	className = "",
	ResponseModal,
}: AiAssistantPanelV2Props) {
	const [apiKeyDraft, setApiKeyDraft] = useState("");

	const {
		campaignSlug,
		sessions,
		activeSession,
		activeSessionId,
		availableModels,
		availableImageModels,
		selectedImageModel,
		inputValue,
		selectedModel,
		autoApply,
		contextSettings,
		contextAnchor,
		contextPreview,
		isLoadingContextPreview,
		isCompactingContext,
		compactContextFeedback,
		unsummarizedMessageCount,
		hasCompactedSummary,
		liveTokenBreakdown,
		attachments,
		isSending,
		isLoadingChats,
		busyActionIds,
		errorMessage,
		isApiKeyMissing,
		isSavingApiKey,
		isHistoryOpen,
		isContextSettingsOpen,
		isCommandsInfoOpen,
		isModelPickerOpen,
		isImageGeneratorOpen,
		imageGeneratorPromptDraft,
		diffModalCard,
		setInputValue,
		setAutoApply,
		setSelectedModel,
		setSelectedImageModel,
		setContextSettings,
		setErrorMessage,
		setIsHistoryOpen,
		setIsContextSettingsOpen,
		setIsCommandsInfoOpen,
		setIsModelPickerOpen,
		setIsImageGeneratorOpen,
		setImageGeneratorPromptDraft,
		setDiffModalCard,
		createNewChat,
		selectSession,
		deleteSession,
		sendMessage,
		editAndResendMessage,
		regenerateLastResponse,
		openImageGenerator,
		generateChatImage,
		cancelSending,
		applyActionCard,
		saveCardDraftResources,
		undoActionCard,
		rejectActionCard,
		addAttachments,
		removeAttachment,
		saveApiKey,
		togglePinAnchor,
		resyncAnchorToCurrentWorkspace,
		insertCommand,
		compactChatContext,
	} = state;

	const handleApiKeySubmit = async (e: FormEvent) => {
		e.preventDefault();
		const ok = await saveApiKey(apiKeyDraft);
		if (ok) setApiKeyDraft("");
	};

	return (
		<div className={`AiAssistantPanelV2 ${className}`}>
			<AiAssistantHeaderV2
				sessionTitle={getLocalizedChatTitle(activeSession)}
				isHistoryOpen={isHistoryOpen}
				onToggleHistory={() => setIsHistoryOpen((prev) => !prev)}
				onCreateNewChat={createNewChat}
				onCollapse={onClose}
			/>

			<AiChatHistoryDropdownV2
				isOpen={isHistoryOpen}
				onClose={() => setIsHistoryOpen(false)}
				sessions={sessions}
				activeSessionId={activeSessionId}
				isLoading={isLoadingChats}
				onSelectSession={(id) => void selectSession(id)}
				onCreateNewChat={createNewChat}
				onDeleteSession={(id) => void deleteSession(id)}
			/>

			<AiContextAnchorBarV2
				contextAnchor={contextAnchor}
				isSettingsOpen={isContextSettingsOpen}
				onToggleSettings={() => setIsContextSettingsOpen((prev) => !prev)}
				onTogglePin={togglePinAnchor}
				onResyncAnchor={resyncAnchorToCurrentWorkspace}
			/>

			<AiContextSettingsPopoverV2
				isOpen={isContextSettingsOpen}
				onClose={() => setIsContextSettingsOpen(false)}
				contextAnchor={contextAnchor}
				contextPreview={contextPreview}
				isLoadingPreview={isLoadingContextPreview}
				tokenBreakdown={liveTokenBreakdown}
				settings={contextSettings}
				onUpdateSettings={setContextSettings}
				onCompactContext={() => void compactChatContext()}
				isCompacting={isCompactingContext}
				canCompact={Boolean(
					activeSession.id &&
						!activeSession.id.startsWith("draft-") &&
						unsummarizedMessageCount > 0 &&
						!isSending,
				)}
				unsummarizedCount={unsummarizedMessageCount}
				hasCompactedSummary={hasCompactedSummary}
				compactFeedback={formatCompactContextFeedback(compactContextFeedback)}
			/>

			{isApiKeyMissing && (
				<form className="AiAssistantPanelV2__apiKeyBanner" onSubmit={(e) => void handleApiKeySubmit(e)}>
					<div className="AiAssistantPanelV2__apiKeyText">
						{lang.t("A Gemini API key is required to use the chat.")}
					</div>
					<div className="AiAssistantPanelV2__apiKeyRow">
						<input
							type="password"
							className="AiAssistantPanelV2__apiKeyInput"
							placeholder="AIza..."
							value={apiKeyDraft}
							onChange={(e) => setApiKeyDraft(e.target.value)}
							disabled={isSavingApiKey}
						/>
						<button
							type="submit"
							className="AiAssistantPanelV2__apiKeySubmit"
							disabled={isSavingApiKey || !apiKeyDraft.trim()}
						>
							{isSavingApiKey ? "..." : lang.t("Save")}
						</button>
					</div>
				</form>
			)}

			{errorMessage && (
				<div className="AiAssistantPanelV2__errorBanner" role="alert">
					<span>{errorMessage}</span>
					<button
						type="button"
						className="AiAssistantPanelV2__errorClose"
						onClick={() => setErrorMessage(null)}
						aria-label={lang.t("Dismiss error message")}
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			)}

			<AiChatMessagesListV2
				messages={activeSession.messages}
				isLoadingChats={isLoadingChats}
				isSending={isSending}
				isLegacyArchive={Boolean(activeSession.isLegacyArchive)}
				canGenerateImages={availableImageModels.length > 0}
				busyActionIds={busyActionIds}
				onApplyActionCard={applyActionCard}
				onUndoActionCard={undoActionCard}
				onRejectActionCard={rejectActionCard}
				onOpenDiff={(card) => setDiffModalCard(card)}
				onSelectSuggestion={(text) => void sendMessage(text)}
				onEditUserMessage={(messageId, nextText) => void editAndResendMessage(messageId, nextText)}
				onRegenerateAssistant={() => void regenerateLastResponse()}
				onGenerateImageFromPrompt={(prompt) => openImageGenerator(prompt)}
			/>

			<AiDiffPreviewModalV2
				card={diffModalCard}
				campaignSlug={campaignSlug}
				ResponseModal={ResponseModal}
				isBusy={Boolean(diffModalCard && busyActionIds.has(diffModalCard.id))}
				onClose={() => setDiffModalCard(null)}
				onApply={applyActionCard}
				onUndo={undoActionCard}
				onSaveDraftResources={saveCardDraftResources}
			/>

			<div className="AiAssistantPanelV2__composerDock">
				<AiChatComposerV2
					value={inputValue}
					onChange={setInputValue}
					onSend={() => void sendMessage()}
					onCancelSend={cancelSending}
					isSending={isSending}
					models={availableModels}
					selectedModel={selectedModel}
					autoApply={autoApply}
					onToggleAutoApply={setAutoApply}
					contextAnchorType={contextAnchor.type}
					isModelPickerOpen={isModelPickerOpen}
					onToggleModelPicker={() => setIsModelPickerOpen((prev) => !prev)}
					isCommandsInfoOpen={isCommandsInfoOpen}
					onToggleCommandsInfo={() => setIsCommandsInfoOpen((prev) => !prev)}
					isImageGeneratorOpen={isImageGeneratorOpen}
					onToggleImageGenerator={() => {
						if (isImageGeneratorOpen) {
							setIsImageGeneratorOpen(false);
						} else {
							openImageGenerator();
						}
					}}
					attachments={attachments}
					onAddAttachments={(files) => void addAttachments(files)}
					onRemoveAttachment={removeAttachment}
					commandsPopover={
						<AiCommandsInfoTooltipV2
							isOpen={isCommandsInfoOpen}
							onClose={() => setIsCommandsInfoOpen(false)}
							onSelectCommand={insertCommand}
						/>
					}
					modelPopover={
						<AiModelSelectorDropdownV2
							isOpen={isModelPickerOpen}
							onClose={() => setIsModelPickerOpen(false)}
							models={availableModels}
							selectedModel={selectedModel}
							onSelectModel={setSelectedModel}
						/>
					}
					imageGeneratorPopover={
						<AiImageGeneratorPopoverV2
							isOpen={isImageGeneratorOpen}
							prompt={imageGeneratorPromptDraft}
							imageModels={availableImageModels}
							selectedImageModel={selectedImageModel}
							isSending={isSending}
							onPromptChange={setImageGeneratorPromptDraft}
							onSelectImageModel={setSelectedImageModel}
							onClose={() => setIsImageGeneratorOpen(false)}
							onComposePrompt={() => {
								const trimmed = imageGeneratorPromptDraft.trim();
								setIsImageGeneratorOpen(false);
								if (trimmed) {
									void sendMessage(`@image ${trimmed}`);
								} else {
									insertCommand("@image");
								}
							}}
							onGenerateImage={() =>
								void generateChatImage(imageGeneratorPromptDraft, selectedImageModel)
							}
						/>
					}
				/>
			</div>
		</div>
	);
}
