import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import {
	getCustomMonsterPromptDescription,
	getScenePromptDescription,
	getScenePromptItemKey,
	type ImagePromptEntity,
	type ImagePromptTarget,
} from "../model/imagePromptPicker.ts";
import ImagePromptColumn from "./ImagePromptColumn.tsx";

interface AiImagePromptSelectionProps {
	buildCustomMonsterImageTarget: (
		monster: ImagePromptEntity,
	) => ImagePromptTarget;
	buildLocationImageTarget: (
		location: ImagePromptEntity,
	) => ImagePromptTarget;
	buildNpcImageTarget: (npc: ImagePromptEntity) => ImagePromptTarget;
	buildSceneImageTarget: (scene: ImagePromptEntity) => ImagePromptTarget;
	customMonstersWithImages: ImagePromptEntity[];
	customMonstersWithoutImages: ImagePromptEntity[];
	getCharacterDisplayName: (character: ImagePromptEntity) => string;
	getImagePromptPreview: (description: unknown) => string;
	getLocationDisplayName: (location: ImagePromptEntity) => string;
	getSceneImagePromptDescription: (scene: ImagePromptEntity) => unknown;
	getSceneImagePromptTitle: (
		scene: ImagePromptEntity,
		index: number,
	) => string;
	imagePromptLocations: ImagePromptEntity[];
	imagePromptNpcs: ImagePromptEntity[];
	imagePromptScenes: ImagePromptEntity[];
	isBestiary: boolean;
	isCampaign: boolean;
	isDataLoading: boolean;
	loading: boolean;
	onContinueWithoutSelection: () => void;
	onSelectTarget: (target: ImagePromptTarget) => void;
}

const CUSTOM_MONSTER_COLUMNS = [
	{
		title: "Custom creatures without images",
		emptyLabel: "No custom creatures without images.",
		keyPrefix: "custom-empty",
		collection: "withoutImages" as const,
	},
	{
		title: "Custom creatures with images",
		emptyLabel: "No custom creatures with images.",
		keyPrefix: "custom-image",
		collection: "withImages" as const,
	},
];

function ImagePromptContextChoice({
	loading,
	onContinue,
}: {
	loading: boolean;
	onContinue: () => void;
}) {
	return (
		<div className="AiAssistant__image_prompt_context_choice">
			<div>
				<strong>{lang.t("No element selected")}</strong>
				<span>
					{lang.t("The request will use current context and your instructions.")}
				</span>
			</div>
			<Button
				variant="primary"
				icon="image"
				onClick={onContinue}
				disabled={loading}
			>
				{lang.t("Continue without selection")}
			</Button>
		</div>
	);
}

export default function AiImagePromptSelection({
	buildCustomMonsterImageTarget,
	buildLocationImageTarget,
	buildNpcImageTarget,
	buildSceneImageTarget,
	customMonstersWithImages,
	customMonstersWithoutImages,
	getCharacterDisplayName,
	getImagePromptPreview,
	getLocationDisplayName,
	getSceneImagePromptDescription,
	getSceneImagePromptTitle,
	imagePromptLocations,
	imagePromptNpcs,
	imagePromptScenes,
	isBestiary,
	isCampaign,
	isDataLoading,
	loading,
	onContinueWithoutSelection,
	onSelectTarget,
}: AiImagePromptSelectionProps) {
	const customMonsterCollections = {
		withoutImages: customMonstersWithoutImages,
		withImages: customMonstersWithImages,
	};

	return (
		<div className="AiAssistant__image_prompt_picker">
			<ImagePromptContextChoice
				loading={loading}
				onContinue={onContinueWithoutSelection}
			/>
			{isDataLoading && (
				<div className="AiAssistant__loading">{lang.t("Loading...")}</div>
			)}
			<div className="AiAssistant__image_prompt_columns">
				{isBestiary ? (
					CUSTOM_MONSTER_COLUMNS.map((column) => (
						<ImagePromptColumn
							key={column.keyPrefix}
							title={column.title}
							items={customMonsterCollections[column.collection]}
							emptyLabel={column.emptyLabel}
							getKey={(monster) =>
								`${column.keyPrefix}-${String(monster.name || "")}`
							}
							getName={(monster) => String(monster.name || "")}
							getDescription={getCustomMonsterPromptDescription}
							onSelect={(monster) =>
								onSelectTarget(buildCustomMonsterImageTarget(monster))
							}
							loading={loading}
							getPreview={getImagePromptPreview}
						/>
					))
				) : (
					<>
						<ImagePromptColumn
							title="NPCs"
							items={imagePromptNpcs}
							emptyLabel="No NPCs yet."
							getName={getCharacterDisplayName}
							getDescription={(npc) =>
								npc.description || npc.trait || npc.motivation || ""
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
							getDescription={(location) => location.description || ""}
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
								getKey={getScenePromptItemKey}
								getName={(scene, index) =>
									getSceneImagePromptTitle(
										scene,
										scene._imagePromptIndex ?? index,
									)
								}
								getDescription={(scene) =>
									getScenePromptDescription(
										scene,
										getSceneImagePromptDescription(scene),
									)
								}
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
	);
}
