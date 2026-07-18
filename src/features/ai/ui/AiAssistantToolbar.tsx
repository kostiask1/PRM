import type { Dispatch, SetStateAction } from "react";

import type { AiModelDescriptor } from "../api/aiApi.ts";
import {
	AiContextActions,
	AiEncounterGenerationActions,
	AiEntityGenerationActions,
	AiImagePromptAction,
	AiModelPicker,
	AiResponseParsingAction,
	type AiBooleanSetter,
} from "./AiToolbarControls.tsx";
import { getAiToolbarVisibility } from "./presentationModel.ts";

export interface AiAssistantToolbarProps {
	aiModels: AiModelDescriptor[];
	generateCharacters: boolean;
	generateCustomMonsters: boolean;
	generateEncounters: boolean;
	generateLocations: boolean;
	generateNpcs: boolean;
	isBestiary: boolean;
	isCampaign: boolean;
	isCustomMonsterGenerationVisible: boolean;
	isEncounter: boolean;
	isResponseParsingLocked: boolean;
	loading: boolean;
	onCreateCustomCreature: () => void;
	onOpenContext: () => void;
	onOpenImagePrompt: () => void;
	parseAIResponse: boolean;
	selectedModel: string;
	setGenerateCharacters: AiBooleanSetter;
	setGenerateCustomMonsters: AiBooleanSetter;
	setGenerateEncounters: AiBooleanSetter;
	setGenerateLocations: AiBooleanSetter;
	setGenerateNpcs: AiBooleanSetter;
	setParseAIResponse: AiBooleanSetter;
	setSelectedModel: Dispatch<SetStateAction<string>>;
	setUseContext: AiBooleanSetter;
	useContext: boolean;
}

export default function AiAssistantToolbar(props: AiAssistantToolbarProps) {
	const { showCharacterGeneration, showParsedGenerationOptions } =
		getAiToolbarVisibility(props);
	return (
		<div className="AiAssistant__actions">
			<AiModelPicker
				aiModels={props.aiModels}
				loading={props.loading}
				selectedModel={props.selectedModel}
				setSelectedModel={props.setSelectedModel}
			/>
			<AiContextActions
				isBestiary={props.isBestiary}
				loading={props.loading}
				onOpenContext={props.onOpenContext}
				setUseContext={props.setUseContext}
				useContext={props.useContext}
			/>
			<AiImagePromptAction
				isEncounter={props.isEncounter}
				loading={props.loading}
				onOpenImagePrompt={props.onOpenImagePrompt}
			/>
			<AiEntityGenerationActions
				generateCharacters={props.generateCharacters}
				generateLocations={props.generateLocations}
				generateNpcs={props.generateNpcs}
				isEncounter={props.isEncounter}
				loading={props.loading}
				setGenerateCharacters={props.setGenerateCharacters}
				setGenerateLocations={props.setGenerateLocations}
				setGenerateNpcs={props.setGenerateNpcs}
				showCharacterGeneration={showCharacterGeneration}
				showParsedGenerationOptions={showParsedGenerationOptions}
			/>
			<AiResponseParsingAction
				isBestiary={props.isBestiary}
				isResponseParsingLocked={props.isResponseParsingLocked}
				loading={props.loading}
				parseAIResponse={props.parseAIResponse}
				setParseAIResponse={props.setParseAIResponse}
			/>
			<AiEncounterGenerationActions
				generateCustomMonsters={props.generateCustomMonsters}
				generateEncounters={props.generateEncounters}
				isCampaign={props.isCampaign}
				isCustomMonsterGenerationVisible={
					props.isCustomMonsterGenerationVisible
				}
				isEncounter={props.isEncounter}
				loading={props.loading}
				onCreateCustomCreature={props.onCreateCustomCreature}
				setGenerateCustomMonsters={props.setGenerateCustomMonsters}
				setGenerateEncounters={props.setGenerateEncounters}
				showParsedGenerationOptions={showParsedGenerationOptions}
			/>
		</div>
	);
}
