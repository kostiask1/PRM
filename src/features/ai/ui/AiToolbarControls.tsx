import type { Dispatch, SetStateAction } from "react";

import { classNames, lang } from "../../../shared/lib/index.js";
import { Button, Checkbox, Select } from "../../../shared/ui/index.js";
import type { AiModelDescriptor } from "../api/aiApi.ts";
import renderAiModelOptions from "./AiModelOptions.tsx";
import { getAiEncounterGenerationTogglePlan } from "./presentationModel.ts";

export type AiBooleanSetter = Dispatch<SetStateAction<boolean>>;

export function AiModelPicker({
	aiModels,
	loading,
	selectedModel,
	setSelectedModel,
}: {
	aiModels: AiModelDescriptor[];
	loading: boolean;
	selectedModel: string;
	setSelectedModel: Dispatch<SetStateAction<string>>;
}) {
	const disabled = loading || aiModels.length === 0;
	return (
		<label className="AiAssistant__modelPicker">
			<Select
				className={classNames("AiAssistant__modelSelect", {
					is_disabled: disabled,
				})}
				disabled={disabled}
				value={selectedModel}
				onChange={(event) => {
					if (!disabled) setSelectedModel(event.target.value);
				}}
			>
				{renderAiModelOptions(aiModels)}
			</Select>
		</label>
	);
}

export function AiContextActions({
	isBestiary,
	loading,
	onOpenContext,
	setUseContext,
	useContext,
}: {
	isBestiary: boolean;
	loading: boolean;
	onOpenContext: () => void;
	setUseContext: AiBooleanSetter;
	useContext: boolean;
}) {
	if (isBestiary) return null;
	return (
		<div
			className={classNames("AiAssistant__context_toggle", {
				is_active: useContext,
			})}
		>
			<Checkbox
				checked={useContext}
				onChange={setUseContext}
				title={
					useContext
						? lang.t("Disable context usage")
						: lang.t("Enable context usage")
				}
			/>
			<Button
				variant={useContext ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				icon="database"
				onClick={onOpenContext}
				disabled={loading}
				title={lang.t("Configure context details for AI")}
			>
				{lang.t("Context")}
			</Button>
		</div>
	);
}

export function AiImagePromptAction({
	isEncounter,
	loading,
	onOpenImagePrompt,
}: {
	isEncounter: boolean;
	loading: boolean;
	onOpenImagePrompt: () => void;
}) {
	if (isEncounter) return null;
	return (
		<Button
			variant="ghost"
			size={Button.SIZES.SMALL}
			icon="image"
			onClick={onOpenImagePrompt}
			disabled={loading}
			title={lang.t("Choose an element to generate a prompt")}
		>
			{lang.t("Image prompt")}
		</Button>
	);
}

export function AiEntityGenerationActions({
	generateCharacters,
	generateLocations,
	generateNpcs,
	isEncounter,
	loading,
	setGenerateCharacters,
	setGenerateLocations,
	setGenerateNpcs,
	showCharacterGeneration,
	showParsedGenerationOptions,
}: {
	generateCharacters: boolean;
	generateLocations: boolean;
	generateNpcs: boolean;
	isEncounter: boolean;
	loading: boolean;
	setGenerateCharacters: AiBooleanSetter;
	setGenerateLocations: AiBooleanSetter;
	setGenerateNpcs: AiBooleanSetter;
	showCharacterGeneration: boolean;
	showParsedGenerationOptions: boolean;
}) {
	if (!showParsedGenerationOptions || isEncounter) return null;
	return (
		<>
			{showCharacterGeneration && (
				<Button
					variant={generateCharacters ? "primary" : "ghost"}
					size={Button.SIZES.SMALL}
					icon="users"
					onClick={() => setGenerateCharacters((value) => !value)}
					disabled={loading}
					title={lang.t("Create characters with AI")}
				>
					{lang.t("Create characters")}
				</Button>
			)}
			<Button
				variant={generateNpcs ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				icon="folder-npc"
				onClick={() => setGenerateNpcs((value) => !value)}
				disabled={loading}
				title={lang.t("Create NPCs with AI")}
			>
				{lang.t("Create NPCs")}
			</Button>
			<Button
				variant={generateLocations ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				icon="map"
				onClick={() => setGenerateLocations((value) => !value)}
				disabled={loading}
				title={lang.t("Create locations/factions with AI")}
			>
				{lang.t("Create locations/factions")}
			</Button>
		</>
	);
}

export function AiResponseParsingAction({
	isBestiary,
	isResponseParsingLocked,
	loading,
	parseAIResponse,
	setParseAIResponse,
}: {
	isBestiary: boolean;
	isResponseParsingLocked: boolean;
	loading: boolean;
	parseAIResponse: boolean;
	setParseAIResponse: AiBooleanSetter;
}) {
	if (isBestiary) return null;
	return (
		<Button
			variant={
				parseAIResponse || isResponseParsingLocked ? "primary" : "ghost"
			}
			size={Button.SIZES.SMALL}
			icon="list"
			onClick={() => {
				if (!isResponseParsingLocked) setParseAIResponse(!parseAIResponse);
			}}
			disabled={loading || isResponseParsingLocked}
			title={
				parseAIResponse
					? lang.t("Parse AI response into form fields")
					: lang.t("Show response as text in a modal")
			}
		>
			{lang.t("Response parsing")}
		</Button>
	);
}

export function AiEncounterGenerationActions({
	generateCustomMonsters,
	generateEncounters,
	isCampaign,
	isCustomMonsterGenerationVisible,
	isEncounter,
	loading,
	onCreateCustomCreature,
	setGenerateCustomMonsters,
	setGenerateEncounters,
	showParsedGenerationOptions,
}: {
	generateCustomMonsters: boolean;
	generateEncounters: boolean;
	isCampaign: boolean;
	isCustomMonsterGenerationVisible: boolean;
	isEncounter: boolean;
	loading: boolean;
	onCreateCustomCreature: () => void;
	setGenerateCustomMonsters: AiBooleanSetter;
	setGenerateEncounters: AiBooleanSetter;
	showParsedGenerationOptions: boolean;
}) {
	if (!showParsedGenerationOptions) return null;
	const toggleEncounterGeneration = () => {
		const plan = getAiEncounterGenerationTogglePlan(generateEncounters);
		setGenerateEncounters(plan.generateEncounters);
		if (plan.generateCustomMonsters !== null) {
			setGenerateCustomMonsters(plan.generateCustomMonsters);
		}
	};
	return (
		<>
			{!isCampaign && (
				<Button
					variant={generateEncounters ? "primary" : "ghost"}
					size={Button.SIZES.SMALL}
					icon="swords"
					onClick={toggleEncounterGeneration}
					disabled={loading}
					title={
						isEncounter
							? lang.t(
									"AI will update the current encounter with monsters based on character levels",
								)
							: lang.t(
									"AI will try to pick monsters for each scene based on character levels",
								)
					}
				>
					{lang.t("Encounter generation")}
				</Button>
			)}
			{isCustomMonsterGenerationVisible && (
				<Button
					variant={generateCustomMonsters ? "primary" : "ghost"}
					size={Button.SIZES.SMALL}
					icon="wand"
					onClick={() => setGenerateCustomMonsters((value) => !value)}
					disabled={loading}
					title={lang.t(
						"AI may create custom creatures only when official monsters do not fit the scene",
					)}
				>
					{lang.t("Generate monsters")}
				</Button>
			)}
			{isEncounter && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="wand"
					onClick={onCreateCustomCreature}
					disabled={loading}
					title={lang.t("Create custom creature")}
				>
					{lang.t("Create custom creature")}
				</Button>
			)}
		</>
	);
}
