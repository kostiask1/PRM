import Button from "../form/Button";
import Input from "../form/Input";
import Select from "../form/Select";
import Modal from "../common/Modal";
import { lang } from "../../services/localization";

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
	buildCustomMonsterImageTarget,
	buildLocationImageTarget,
	buildNpcImageTarget,
	buildSceneImageTarget,
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
	imagePromptScenes,
	aiModels,
	isBestiary,
	isCampaign,
	isDataLoading,
	isOpen,
	loading,
	onBackToSelection,
	onCancel,
	onGenerate,
	onInstructionsChange,
	onModelChange,
	onSelectTarget,
	selectedModel,
	selectedTarget,
}) {
	if (!isOpen) return null;

	return (
		<Modal
			title={
				selectedTarget
					? lang.t("Image prompt")
					: lang.t("Choose an element to generate a prompt")
			}
			onCancel={onCancel}
			showFooter={false}
			className="AiAssistant__image_prompt_modal"
		>
			{selectedTarget ? (
				<div className="AiAssistant__image_prompt_details">
					<div className="AiAssistant__image_prompt_target">
						<span>{lang.t("Selected element")}</span>
						<strong>{getImagePromptTargetTitle(selectedTarget)}</strong>
					</div>
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
					<Input
						type="textarea"
						value={imagePromptInstructions}
						onChange={(event) => onInstructionsChange(event.target.value)}
						placeholder={lang.t("Optional image prompt instructions...")}
						disabled={loading}
						className="AiAssistant__image_prompt_instructions"
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
							onClick={() => onGenerate(selectedTarget)}
							disabled={loading}
						>
							{lang.t("Generate image prompt")}
						</Button>
					</div>
				</div>
			) : (
				<div className="AiAssistant__image_prompt_picker">
					{isDataLoading && (
						<div className="AiAssistant__loading">{lang.t("Loading...")}</div>
					)}
					{isBestiary ? (
						<>
							<ImagePromptColumn
								title="Custom creatures without images"
								items={customMonstersWithoutImages}
								emptyLabel="No custom creatures without images."
								getKey={(monster) => `custom-empty-${monster?.name}`}
								getName={(monster) => monster?.name || ""}
								getDescription={(monster) =>
									[monster?.type, monster?.cr ? `CR ${monster.cr}` : ""]
										.filter(Boolean)
										.join(" - ")
								}
								onSelect={(monster) =>
									onSelectTarget(buildCustomMonsterImageTarget(monster))
								}
								loading={loading}
								getPreview={getImagePromptPreview}
							/>
							<ImagePromptColumn
								title="Custom creatures with images"
								items={customMonstersWithImages}
								emptyLabel="No custom creatures with images."
								getKey={(monster) => `custom-image-${monster?.name}`}
								getName={(monster) => monster?.name || ""}
								getDescription={(monster) =>
									[monster?.type, monster?.cr ? `CR ${monster.cr}` : ""]
										.filter(Boolean)
										.join(" - ")
								}
								onSelect={(monster) =>
									onSelectTarget(buildCustomMonsterImageTarget(monster))
								}
								loading={loading}
								getPreview={getImagePromptPreview}
							/>
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
			)}
		</Modal>
	);
}
