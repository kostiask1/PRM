import { useContext, useMemo, useState, type FormEvent } from "react";
import { bestiaryApi } from "../../../../entities/bestiary/index.js";
import { resolveEntityByName } from "../../../../entities/campaign/index.js";
import type { AiResponseModalComponent } from "../../../../features/ai/ui/index.js";
import {
	EntityLinkResolverContext,
	type EntityLinkResolver,
} from "../../../../features/entity-link/index.js";
import { lang } from "../../../../shared/lib/index.js";
import {
	formatCompactContextFeedback,
	getLocalizedChatTitle,
} from "../model/aiChatLocalization.ts";
import type { useAiChatState } from "../model/useAiChatState.ts";
import AiAssistantHeaderV2 from "./AiAssistantHeaderV2.tsx";
import AiContextAnchorBarV2 from "./AiContextAnchorBarV2.tsx";
import AiChatMessagesListV2 from "./AiChatMessagesListV2.tsx";
import { ImageGallery } from "../../../../features/images/index.js";
import AiChatComposerV2 from "./AiChatComposerV2.tsx";
import AiChatHistoryDropdownV2 from "./popovers/AiChatHistoryDropdownV2.tsx";
import AiContextSettingsPopoverV2 from "./popovers/AiContextSettingsPopoverV2.tsx";
import AiCommandsInfoTooltipV2 from "./popovers/AiCommandsInfoTooltipV2.tsx";
import AiModelSelectorDropdownV2 from "./popovers/AiModelSelectorDropdownV2.tsx";
import AiDiffPreviewModalV2 from "./AiDiffPreviewModalV2.tsx";

interface AiAssistantPanelV2Props {
	state: ReturnType<typeof useAiChatState>;
	onClose: () => void;
	className?: string;
	onOpenBestiaryCreature?: (name: string) => void;
	ResponseModal?: AiResponseModalComponent;
}

export default function AiAssistantPanelV2({
	state,
	onClose,
	className = "",
	onOpenBestiaryCreature,
	ResponseModal,
}: AiAssistantPanelV2Props) {
	const [apiKeyDraft, setApiKeyDraft] = useState("");
	const parentEntityLinks = useContext(EntityLinkResolverContext);

	const {
		campaignSlug,
		isBestiaryScope,
		workspaceContext,
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
		isAttachMenuOpen,
		isGalleryPickerOpen,
		isImageMode,
		imageModeAction,
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
		setIsAttachMenuOpen,
		setIsGalleryPickerOpen,
		setImageModeAction,
		setDiffModalCard,
		registerComposerFocus,
		focusComposerEditor,
		createNewChat,
		selectSession,
		deleteSession,
		submitComposer,
		editAndResendMessage,
		regenerateLastResponse,
		openImageMode,
		exitImageMode,
		toggleImageMode,
		cancelSending,
		applyActionCard,
		saveCardDraftResources,
		undoActionCard,
		rejectActionCard,
		addAttachments,
		addGalleryAttachment,
		removeAttachment,
		saveApiKey,
		togglePinAnchor,
		resyncAnchorToCurrentWorkspace,
		insertCommand,
		prefillComposer,
		compactChatContext,
	} = state;

	const handleToggleAttachMenu = () => {
		setIsAttachMenuOpen((prev) => {
			const next = !prev;
			if (next) {
				setIsCommandsInfoOpen(false);
				setIsModelPickerOpen(false);
			}
			return next;
		});
	};

	const handleToggleCommandsInfo = () => {
		setIsCommandsInfoOpen((prev) => {
			const next = !prev;
			if (next) {
				setIsAttachMenuOpen(false);
				setIsModelPickerOpen(false);
			}
			return next;
		});
	};

	const handleToggleModelPicker = () => {
		setIsModelPickerOpen((prev) => {
			const next = !prev;
			if (next) {
				setIsAttachMenuOpen(false);
				setIsCommandsInfoOpen(false);
			}
			return next;
		});
	};

	const isImageModelSelectionActive = isImageMode && imageModeAction === "generate";

	const chatEntityLinkResolver = useMemo<EntityLinkResolver>(
		() => ({
			...(parentEntityLinks || {}),
			async resolveEntityByName(name: string) {
				const parentMatch = await parentEntityLinks?.resolveEntityByName?.(name);
				if (parentMatch) return parentMatch;
				if (!isBestiaryScope && campaignSlug && campaignSlug !== "bestiary") {
					const campaignMatch = await resolveEntityByName(campaignSlug, name);
					if (campaignMatch) return campaignMatch;
				}
				const [rawMonsterName, rawSource] = String(name || "").split("|");
				const cleanName = (rawMonsterName || "").trim();
				const requestedSource = (rawSource || "").trim().toUpperCase();
				if (!cleanName) return null;
				const results = (await bestiaryApi.searchBestiary(cleanName)) || [];
				const normalizedTarget = cleanName.toLowerCase();
				const creature =
					results.find(
						(item) =>
							String(item.name || "").trim().toLowerCase() === normalizedTarget &&
							(!requestedSource ||
								String(item.source || "").trim().toUpperCase() === requestedSource),
					) ||
					results.find(
						(item) =>
							String(item.name || "").trim().toLowerCase() === normalizedTarget,
					);
				if (creature?.name) {
					const referenceName = [
						String(creature.name).trim(),
						String(creature.source || "").trim(),
					]
						.filter(Boolean)
						.join("|");
					onOpenBestiaryCreature?.(referenceName);
				}
				return null;
			},
		}),
		[campaignSlug, isBestiaryScope, onOpenBestiaryCreature, parentEntityLinks],
	);

	const handleApiKeySubmit = async (e: FormEvent) => {
		e.preventDefault();
		const ok = await saveApiKey(apiKeyDraft);
		if (ok) setApiKeyDraft("");
	};

	return (
		<EntityLinkResolverContext.Provider value={chatEntityLinkResolver}>
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
				workspaceContext={workspaceContext}
				isBestiaryScope={isBestiaryScope}
				busyActionIds={busyActionIds}
				onApplyActionCard={applyActionCard}
				onUndoActionCard={undoActionCard}
				onRejectActionCard={rejectActionCard}
				onOpenDiff={(card) => setDiffModalCard(card)}
				onSelectSuggestion={(text) => prefillComposer(text)}
				onEditUserMessage={(messageId, nextText) => void editAndResendMessage(messageId, nextText)}
				onRegenerateAssistant={() => void regenerateLastResponse()}
				onGenerateImageFromPrompt={(prompt) => openImageMode(prompt)}
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

			<ImageGallery
				isOpen={isGalleryPickerOpen}
				onClose={() => {
					setIsGalleryPickerOpen(false);
					focusComposerEditor();
				}}
				onSelect={(image) => addGalleryAttachment(image)}
			/>

			<div className="AiAssistantPanelV2__composerDock">
				<AiChatComposerV2
					value={inputValue}
					onChange={setInputValue}
					onSend={() => void submitComposer()}
					onCancelSend={cancelSending}
					isSending={isSending}
					models={availableModels}
					selectedModel={selectedModel}
					imageModels={availableImageModels}
					selectedImageModel={selectedImageModel}
					autoApply={autoApply}
					onToggleAutoApply={setAutoApply}
					contextAnchorType={contextAnchor.type}
					isModelPickerOpen={isModelPickerOpen}
					onToggleModelPicker={handleToggleModelPicker}
					isCommandsInfoOpen={isCommandsInfoOpen}
					onToggleCommandsInfo={handleToggleCommandsInfo}
					isImageMode={isImageMode}
					imageModeAction={imageModeAction}
					onToggleImageMode={toggleImageMode}
					onExitImageMode={exitImageMode}
					onChangeImageModeAction={(action) => {
						setImageModeAction(action);
						setIsModelPickerOpen(false);
					}}
					isAttachMenuOpen={isAttachMenuOpen}
					onToggleAttachMenu={handleToggleAttachMenu}
					onCloseAttachMenu={() => setIsAttachMenuOpen(false)}
					onOpenGalleryPicker={() => {
						setIsAttachMenuOpen(false);
						setIsGalleryPickerOpen(true);
					}}
					onRegisterFocus={registerComposerFocus}
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
							models={isImageModelSelectionActive ? availableImageModels : availableModels}
							selectedModel={isImageModelSelectionActive ? selectedImageModel : selectedModel}
							onSelectModel={
								isImageModelSelectionActive ? setSelectedImageModel : setSelectedModel
							}
							title={isImageModelSelectionActive ? lang.t("Image model") : undefined}
							ariaLabel={
								isImageModelSelectionActive ? lang.t("Select image model") : undefined
							}
							useFallbackModels={!isImageModelSelectionActive}
						/>
					}
				/>
			</div>
		</div>
		</EntityLinkResolverContext.Provider>
	);
}
