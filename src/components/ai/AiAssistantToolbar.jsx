import Button from "../form/Button";
import Checkbox from "../form/Checkbox";
import Select from "../form/Select";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";

export default function AiAssistantToolbar({
	aiModels,
	entityScopeIsSession,
	generateCharacters,
	generateCustomMonsters,
	generateEncounters,
	generateLocations,
	generateNpcs,
	isBestiary,
	isCampaign,
	isCustomMonsterGenerationVisible,
	isEncounter,
	isEntityScopeVisible,
	isResponseParsingLocked,
	loading,
	onCreateCustomCreature,
	onOpenContext,
	onOpenImagePrompt,
	parseAIResponse,
	selectedModel,
	setEntityScope,
	setGenerateCharacters,
	setGenerateCustomMonsters,
	setGenerateEncounters,
	setGenerateLocations,
	setGenerateNpcs,
	setParseAIResponse,
	setSelectedModel,
	setUseContext,
	useContext,
}) {
	return (
		<div className="AiAssistant__actions">
			<label className="AiAssistant__modelPicker">
				<Select
					className={classNames("AiAssistant__modelSelect", {
						is_disabled: loading || aiModels.length === 0,
					})}
					disabled={loading || aiModels.length === 0}
					value={selectedModel}
					onChange={(event) => {
						if (loading || aiModels.length === 0) return;
						setSelectedModel(event.target.value);
					}}
				>
					{aiModels.length > 0 ? (
						aiModels.map((model) => (
							<option key={model.name} value={model.name}>
								{model.displayName || model.name}
							</option>
						))
					) : (
						<option key="loading" value="">
							{lang.t("Loading models...")}
						</option>
					)}
				</Select>
			</label>
			{!isBestiary && (
				<div
					className={classNames("AiAssistant__context_toggle", {
						is_active: useContext,
					})}
				>
					<Checkbox
						checked={useContext}
						onChange={(value) => setUseContext(value)}
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
			)}
			{!isEncounter && (
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
			)}
			{!isBestiary && !isEncounter && (
				<>
					<Button
						variant={generateCharacters ? "primary" : "ghost"}
						size={Button.SIZES.SMALL}
						icon="users"
						onClick={() => setGenerateCharacters((prev) => !prev)}
						disabled={loading}
						title={lang.t("Create characters with AI")}
					>
						{lang.t("Create characters")}
					</Button>
					<Button
						variant={generateNpcs ? "primary" : "ghost"}
						size={Button.SIZES.SMALL}
						icon="folder-npc"
						onClick={() => setGenerateNpcs((prev) => !prev)}
						disabled={loading}
						title={lang.t("Create NPCs with AI")}
					>
						{lang.t("Create NPCs")}
					</Button>
					<Button
						variant={generateLocations ? "primary" : "ghost"}
						size={Button.SIZES.SMALL}
						icon="map"
						onClick={() => setGenerateLocations((prev) => !prev)}
						disabled={loading}
						title={lang.t("Create locations/factions with AI")}
					>
						{lang.t("Create locations/factions")}
					</Button>
					{isEntityScopeVisible && (
						<Button
							variant={entityScopeIsSession ? "primary" : "ghost"}
							size={Button.SIZES.SMALL}
							icon={entityScopeIsSession ? "file" : "database"}
							onClick={() =>
								setEntityScope((prev) =>
									prev === "campaign" ? "session" : "campaign",
								)
							}
							disabled={loading}
							title={
								entityScopeIsSession
									? lang.t(
											"AI will create NPCs and locations inside this session",
										)
									: lang.t("AI will create NPCs and locations in the campaign")
							}
						>
							{entityScopeIsSession
								? lang.t("Session scope")
								: lang.t("Campaign scope")}
						</Button>
					)}
				</>
			)}
			{!isBestiary && (
				<Button
					variant={
						parseAIResponse || isResponseParsingLocked ? "primary" : "ghost"
					}
					size={Button.SIZES.SMALL}
					icon="list"
					onClick={() => {
						if (isResponseParsingLocked) return;
						setParseAIResponse(!parseAIResponse);
					}}
					disabled={loading || isResponseParsingLocked}
					title={
						generateEncounters
							? lang.t("Parsing is required when generating encounters")
							: parseAIResponse
								? lang.t("Parse AI response into form fields")
								: lang.t("Show response as text in a modal")
					}
				>
					{lang.t("Response parsing")}
				</Button>
			)}
			{!isBestiary && !isCampaign && (
				<Button
					variant={generateEncounters ? "primary" : "ghost"}
					size={Button.SIZES.SMALL}
					icon="swords"
					onClick={() => {
						const enabled = !generateEncounters;
						setGenerateEncounters(enabled);
						if (enabled) {
							setParseAIResponse(true);
						} else if (isEncounter) {
							setParseAIResponse(false);
						}
						if (!enabled) {
							setGenerateCustomMonsters(false);
						}
					}}
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
					onClick={() => setGenerateCustomMonsters((enabled) => !enabled)}
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
		</div>
	);
}
