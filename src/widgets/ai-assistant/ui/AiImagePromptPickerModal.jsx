import { Button, Select } from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { Modal } from "../../../features/modal/index.js";
import { AiAttachmentControls } from "../../../features/ai/ui/index.js";
import { lang } from "../../../shared/lib/index.js";

function ImagePromptColumn({
	title,
	items,
	emptyLabel,
	getName,
	getDescription,
	getKey = null,
	onSelect,
	loading,
	getPreview,
}) {
	return (
		<section className="AiAssistant__image_prompt_column">
			<h4>{lang.t(title)}</h4>
			<div className="AiAssistant__image_prompt_list">
				{items.length > 0 ? (
					items.map((item, index) => {
						const key =
							getKey?.(item, index) ||
							item?.id ||
							item?.slug ||
							`${title}-${index}`;
						const description = getPreview(getDescription(item, index));
						return (
							<button
								key={key}
								type="button"
								className="AiAssistant__image_prompt_item"
								onClick={() => onSelect(item, index)}
								disabled={loading}
								title={lang.t("Generate visual prompt for this item")}
							>
								<strong>{getName(item, index)}</strong>
								{description && <span>{description}</span>}
							</button>
						);
					})
				) : (
					<div className="muted AiAssistant__empty_context">
						{lang.t(emptyLabel)}
					</div>
				)}
			</div>
		</section>
	);
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
	imagePromptRequest,
	imagePromptLocations,
	imagePromptNpcs,
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
	selectedTarget,
	setAttachedFiles,
	setAttachedImages,
}) {
	if (!isOpen) return null;

	const isDetailsVisible = Boolean(selectedTarget || isContextMode);
	const instructionsRequired = Boolean(isContextMode);
	const canGenerate =
		!loading &&
		(!instructionsRequired || String(imagePromptRequest || "").trim());
	const customMonsterColumns = [
		{
			title: "Custom creatures without images",
			items: customMonstersWithoutImages,
			emptyLabel: "No custom creatures without images.",
			keyPrefix: "custom-empty",
		},
		{
			title: "Custom creatures with images",
			items: customMonstersWithImages,
			emptyLabel: "No custom creatures with images.",
			keyPrefix: "custom-image",
		},
	];
	const getCustomMonsterDescription = (monster) =>
		[monster?.type, monster?.cr ? `CR ${monster.cr}` : ""]
			.filter(Boolean)
			.join(" - ");

	return (
		<Modal
			title={
				isDetailsVisible
					? lang.t("Image prompt")
					: lang.t("Choose an element to generate a prompt")
			}
			onCancel={onCancel}
			showFooter={false}
			className="AiAssistant__image_prompt_modal"
			cancelDisabled={loading}
		>
			{isDetailsVisible ? (
				<div className="AiAssistant__image_prompt_details">
					{selectedTarget ? (
						<div className="AiAssistant__image_prompt_target">
							<span>{lang.t("Selected element")}</span>
							<strong>{getImagePromptTargetTitle(selectedTarget)}</strong>
						</div>
					) : (
						<div className="AiAssistant__image_prompt_target">
							<span>{lang.t("No element selected")}</span>
							<strong>
								{lang.t(
									"The request will use current context and your instructions.",
								)}
							</strong>
						</div>
					)}
					<Select
						className="AiAssistant__image_prompt_model"
						value={selectedModel}
						onChange={(event) => onModelChange(event.target.value)}
						disabled={
							loading || !Array.isArray(aiModels) || aiModels.length === 0
						}
					>
						{Array.isArray(aiModels) && aiModels.length > 0 ? (
							aiModels.map((model) => (
								<option key={model.name} value={model.name}>
									{model.displayName || model.name}
								</option>
							))
						) : (
							<option value="">{lang.t("Loading models...")}</option>
						)}
					</Select>
					{isContextMode && (
						<label className="AiAssistant__image_prompt_field">
							<span>{lang.t("What to generate")}</span>
							<EditableField
								type="textarea"
								value={imagePromptRequest}
								onChange={(event) => onRequestChange(event.target.value)}
								placeholder={lang.t(
									"Describe what image prompt to generate...",
								)}
								required
								disabled={loading}
								className="AiAssistant__image_prompt_model AiAssistant__image_prompt_instructions"
							/>
						</label>
					)}
					<label className="AiAssistant__image_prompt_field">
						<span>{lang.t("Base image prompt")}</span>
						<EditableField
							type="textarea"
							value={imagePromptInstructions}
							onChange={(event) => onInstructionsChange(event.target.value)}
							placeholder={lang.t("Optional image prompt instructions...")}
							disabled={loading}
							className="AiAssistant__image_prompt_model AiAssistant__image_prompt_instructions"
						/>
					</label>
					<AiAttachmentControls
						attachedFiles={attachedFiles}
						attachedImages={attachedImages}
						campaignSlug={campaignSlug}
						disabled={loading}
						setAttachedFiles={setAttachedFiles}
						setAttachedImages={setAttachedImages}
					/>
					<div className="AiAssistant__image_prompt_actions">
						<Button
							variant="ghost"
							icon="back"
							onClick={onBackToSelection}
							disabled={loading}
						>
							{lang.t("Back to selection")}
						</Button>
						<Button
							variant="primary"
							icon="image"
							onClick={() => onGenerate(selectedTarget || null)}
							disabled={!canGenerate}
						>
							{lang.t("Generate image prompt")}
						</Button>
					</div>
				</div>
			) : (
				<div className="AiAssistant__image_prompt_picker">
					<div className="AiAssistant__image_prompt_context_choice">
						<div>
							<strong>{lang.t("No element selected")}</strong>
							<span>
								{lang.t(
									"The request will use current context and your instructions.",
								)}
							</span>
						</div>
						<Button
							variant="primary"
							icon="image"
							onClick={onContinueWithoutSelection}
							disabled={loading}
						>
							{lang.t("Continue without selection")}
						</Button>
					</div>
					{isDataLoading && (
						<div className="AiAssistant__loading">{lang.t("Loading...")}</div>
					)}
					<div className="AiAssistant__image_prompt_columns">
						{isBestiary ? (
							<>
								{customMonsterColumns.map((column) => (
									<ImagePromptColumn
										key={column.keyPrefix}
										title={column.title}
										items={column.items}
										emptyLabel={column.emptyLabel}
										getKey={(monster) => `${column.keyPrefix}-${monster?.name}`}
										getName={(monster) => monster?.name || ""}
										getDescription={getCustomMonsterDescription}
										onSelect={(monster) =>
											onSelectTarget(buildCustomMonsterImageTarget(monster))
										}
										loading={loading}
										getPreview={getImagePromptPreview}
									/>
								))}
							</>
						) : (
							<>
								<ImagePromptColumn
									title="NPCs"
									items={imagePromptNpcs}
									emptyLabel="No NPCs yet."
									getName={getCharacterDisplayName}
									getDescription={(npc) =>
										npc?.description || npc?.trait || npc?.motivation || ""
									}
									onSelect={(npc) => onSelectTarget(buildNpcImageTarget(npc))}
									loading={loading}
									getPreview={getImagePromptPreview}
								/>
								<ImagePromptColumn
									title="Locations/Factions"
									items={imagePromptLocations}
									emptyLabel="No locations/factions yet."
									getName={getLocationDisplayName}
									getDescription={(location) => location?.description || ""}
									onSelect={(location) =>
										onSelectTarget(buildLocationImageTarget(location))
									}
									loading={loading}
									getPreview={getImagePromptPreview}
								/>
								{!isCampaign && (
									<ImagePromptColumn
										title="Scenes"
										items={imagePromptScenes}
										emptyLabel="No scenes found."
										getKey={(scene, index) =>
											[scene?._imagePromptSessionFileName, scene?.id, index]
												.filter(Boolean)
												.join(":")
										}
										getName={(scene, index) =>
											getSceneImagePromptTitle(
												scene,
												scene?._imagePromptIndex ?? index,
											)
										}
										getDescription={(scene) => {
											const sessionName = scene?._imagePromptSessionName;
											const description = getSceneImagePromptDescription(scene);
											return [sessionName, description]
												.filter(Boolean)
												.join(" - ");
										}}
										onSelect={(scene) =>
											onSelectTarget(buildSceneImageTarget(scene))
										}
										loading={loading}
										getPreview={getImagePromptPreview}
									/>
								)}
							</>
						)}
					</div>
				</div>
			)}
		</Modal>
	);
}
