export const ESTIMATED_IMAGE_TOKENS = 260;
export const ESTIMATED_FILE_TOKEN_BYTES = 4;

export type EstimatedAiMode =
	| "prompt"
	| "campaign"
	| "scene"
	| "encounter"
	| "custom-monster"
	| "image";

export const SYSTEM_TOKEN_ESTIMATES: Readonly<Record<EstimatedAiMode, number>> = Object.freeze({
	prompt: 650,
	campaign: 1500,
	scene: 1900,
	encounter: 1200,
	"custom-monster": 2200,
	image: 550,
});

interface EstimateNote extends Record<string, unknown> {
	_aiIgnored?: boolean;
	title?: string;
	text?: string;
}

interface EstimateEntity extends Record<string, unknown> {
	_aiIgnored?: boolean;
	firstName?: string;
	first_name?: string;
	lastName?: string;
	last_name?: string;
	name?: string;
	title?: string;
	description?: string;
	motivation?: string;
	trait?: unknown;
	notes?: EstimateNote[];
}

interface EstimateScene extends Record<string, unknown> {
	texts?: Record<string, unknown>;
	notes?: EstimateNote[];
	npcs?: EstimateEntity[];
	encounterId?: string | number;
}

interface EstimateSession extends Record<string, unknown> {
	name?: string;
	description?: string;
	result_text?: string;
	notes?: EstimateNote[];
	scenes?: EstimateScene[];
	characters?: EstimateEntity[];
	npcs?: EstimateEntity[];
	locations?: EstimateEntity[];
}

interface EstimateContextList {
	included?: boolean;
	items?: Record<string, boolean>;
}

interface EstimateContextConfig extends Record<string, unknown> {
	campaignNotes?: boolean;
	sessions?: Record<
		string,
		{ included?: boolean; data?: EstimateSession } & Record<string, unknown>
	>;
}

interface EstimateAttachment {
	name?: string;
	url?: string;
	mimeType?: string;
	sizeBytes?: number;
}

export interface AiTokenEstimate {
	textTokens: number;
	imageTokens: number;
	fileTokens: number;
	total: number;
}

export interface AiAttachmentTokenEstimate {
	imageTokens: number;
	fileTokens: number;
}

export type AiTokenEstimateContext = Record<string, unknown>;

export interface AiTokenEstimateInput {
	activeCampaignBasePrompt?: string;
	attachedFiles?: EstimateAttachment[];
	attachedImages?: EstimateAttachment[];
	campaignContext?: EstimateSession;
	characterContext?: EstimateContextList;
	charactersList?: EstimateEntity[];
	contextConfig: EstimateContextConfig;
	currentLanguage?: string;
	editEncounterCreatures?: boolean;
	generateCharacters?: boolean;
	generateCustomMonsters?: boolean;
	generateEncounters?: boolean;
	generateLocations?: boolean;
	generateNpcs?: boolean;
	globalAiBasePrompt?: string;
	isBestiary?: boolean;
	isCampaign?: boolean;
	isEncounter?: boolean;
	locationContext?: EstimateContextList;
	locationsList?: EstimateEntity[];
	npcContext?: EstimateContextList;
	npcsList?: EstimateEntity[];
	parseAIResponse?: boolean;
	selectedModel?: string;
	sessionData?: EstimateSession;
	sessionName?: string;
	useContext?: boolean;
	userInstructions?: string;
	getCharacterKey(entity: EstimateEntity): string;
	getLocationKey(entity: EstimateEntity): string;
}

export function estimateTextTokens(text: unknown): number {
	const value = String(text || "");
	if (!value.trim()) return 0;

	const cyrillic = (value.match(/[\u0400-\u04ff]/g) || []).length;
	const latinDigits = (value.match(/[A-Za-z0-9]/g) || []).length;
	const whitespace = (value.match(/\s/g) || []).length;
	const other = Math.max(0, value.length - cyrillic - latinDigits - whitespace);
	return Math.ceil(cyrillic / 2.7 + latinDigits / 4 + other / 3.5);
}

export function estimateValueTokens(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "string") return estimateTextTokens(value);
	return estimateTextTokens(JSON.stringify(value));
}

export function compactNoteForEstimate(
	note: EstimateNote | null | undefined,
): { title: string; text: string } | null {
	if (!note || note._aiIgnored) return null;
	return {
		title: note.title || "",
		text: note.text || "",
	};
}

function getTruthyEstimateField(
	entity: EstimateEntity,
	field: keyof EstimateEntity,
): unknown {
	return entity[field] || "";
}

function getFirstTruthyEstimateValue<T>(
	values: readonly (T | undefined)[],
	fallback: T,
): T {
	for (const value of values) {
		if (value) return value;
	}
	return fallback;
}

function getEstimateEntityName(entity: EstimateEntity): string {
	const firstName = getFirstTruthyEstimateValue(
		[entity.firstName, entity.first_name],
		"",
	);
	const lastName = getFirstTruthyEstimateValue(
		[entity.lastName, entity.last_name],
		"",
	);
	const fullName = [firstName, lastName].filter(Boolean).join(" ");
	return getFirstTruthyEstimateValue(
		[fullName, entity.name, entity.title],
		"",
	);
}

export function compactEntityForEstimate(
	entity: EstimateEntity | null | undefined,
) {
	if (!entity || entity._aiIgnored) return null;
	return {
		name: getEstimateEntityName(entity),
		description: getTruthyEstimateField(entity, "description"),
		motivation: getTruthyEstimateField(entity, "motivation"),
		trait: getTruthyEstimateField(entity, "trait"),
		notes: compactEstimateNotes(entity.notes),
	};
}

export function compactSessionForEstimate(data: EstimateSession = {}) {
	return {
		notes: (data.notes || []).map(compactNoteForEstimate).filter(Boolean),
		result: data.result_text || "",
		scenes: (data.scenes || []).map((scene: EstimateScene) => ({
			texts: scene.texts || {},
			notes: (scene.notes || []).map(compactNoteForEstimate).filter(Boolean),
			npcs: scene.npcs || [],
			encounterId: scene.encounterId || "",
		})),
		npcs: (data.npcs || []).map(compactEntityForEstimate).filter(Boolean),
		locations: (data.locations || [])
			.map(compactEntityForEstimate)
			.filter(Boolean),
	};
}

export function getEstimatedAiMode({
	isBestiary,
	isEncounter,
	isCampaign,
	parseAIResponse,
}: {
	isBestiary?: boolean;
	isEncounter?: boolean;
	isCampaign?: boolean;
	parseAIResponse?: boolean;
}): EstimatedAiMode {
	if (isBestiary) return "custom-monster";
	if (!parseAIResponse) return "prompt";
	if (isEncounter) return "encounter";
	if (isCampaign) return "campaign";
	return "scene";
}

function filterByContextList<T>(
	list: T[] | null | undefined,
	config: EstimateContextList | null | undefined,
	getKey: (item: T) => string,
): T[] {
	const items = config?.items || {};
	const hasExplicitItems = Object.keys(items).length > 0;
	if (config?.included === false) return [];
	return (Array.isArray(list) ? list : []).filter(
		(item) => !hasExplicitItems || items[getKey(item)] !== false,
	);
}

const compactEntities = (list: EstimateEntity[]) =>
	list.map(compactEntityForEstimate).filter(Boolean);

function compactEstimateNotes(notes: EstimateNote[] | null | undefined) {
	return (notes || []).map(compactNoteForEstimate).filter(Boolean);
}

function getCampaignModeEntityList(
	input: AiTokenEstimateInput,
	field: "characters" | "npcs" | "locations",
): EstimateEntity[] {
	const fallbackLists = {
		characters: input.charactersList,
		npcs: input.npcsList,
		locations: input.locationsList,
	};
	return input.sessionData?.[field] || fallbackLists[field] || [];
}

function buildCampaignModeHeader(
	input: AiTokenEstimateInput,
): Record<string, unknown> {
	return {
		name: input.sessionData?.name || input.sessionName || "",
		description: input.sessionData?.description || "",
	};
}

function buildCampaignModeNotes(
	input: AiTokenEstimateInput,
): Record<string, unknown> {
	return input.contextConfig.campaignNotes
		? { notes: compactEstimateNotes(input.sessionData?.notes) }
		: {};
}

function buildCampaignModeEntities(
	input: AiTokenEstimateInput,
): Record<string, unknown> {
	return {
		characters: compactEntities(
			filterByContextList(
				getCampaignModeEntityList(input, "characters"),
				input.characterContext,
				input.getCharacterKey,
			),
		),
		npcs: compactEntities(
			filterByContextList(
				getCampaignModeEntityList(input, "npcs"),
				input.npcContext,
				input.getCharacterKey,
			),
		),
		locations: compactEntities(
			filterByContextList(
				getCampaignModeEntityList(input, "locations"),
				input.locationContext,
				input.getLocationKey,
			),
		),
	};
}

function buildCampaignModeContext(
	input: AiTokenEstimateInput,
): AiTokenEstimateContext {
	const campaign = buildCampaignModeHeader(input);
	if (!input.useContext) return { campaign };
	return {
		campaign: {
			...campaign,
			...buildCampaignModeNotes(input),
			...buildCampaignModeEntities(input),
		},
	};
}

function buildCurrentScopeContext(
	input: AiTokenEstimateInput,
): AiTokenEstimateContext {
	if (input.isEncounter) return { currentEncounter: input.sessionData || {} };
	if (input.parseAIResponse) {
		return { currentSession: compactSessionForEstimate(input.sessionData || {}) };
	}
	return {};
}

function buildSelectedSessionContext(
	contextConfig: EstimateContextConfig,
): unknown[] {
	return Object.entries(contextConfig.sessions || {})
		.filter(([, config]) => config?.included && config?.data)
		.map(([slug, config]) => ({
			slug,
			data: compactSessionForEstimate(config.data),
		}));
}

function buildSharedCampaignContext(
	input: AiTokenEstimateInput,
): Record<string, unknown> {
	return {
		description: input.campaignContext?.description || "",
		notes: input.contextConfig.campaignNotes
			? compactEstimateNotes(input.campaignContext?.notes)
			: [],
		characters: compactEntities(
			filterByContextList(
				input.charactersList,
				input.characterContext,
				input.getCharacterKey,
			),
		),
		npcs: compactEntities(
			filterByContextList(
				input.npcsList,
				input.npcContext,
				input.getCharacterKey,
			),
		),
		locations: compactEntities(
			filterByContextList(
				input.locationsList,
				input.locationContext,
				input.getLocationKey,
			),
		),
	};
}

function buildSessionModeContext(
	input: AiTokenEstimateInput,
): AiTokenEstimateContext {
	const context: AiTokenEstimateContext = {
		campaign: { description: input.campaignContext?.description || "" },
		...buildCurrentScopeContext(input),
	};
	if (!input.useContext) return context;
	return {
		...context,
		campaign: buildSharedCampaignContext(input),
		selectedSessions: buildSelectedSessionContext(input.contextConfig),
	};
}

export function buildAiTokenEstimateContext(
	input: AiTokenEstimateInput,
): AiTokenEstimateContext {
	if (input.isBestiary) return {};
	return input.isCampaign
		? buildCampaignModeContext(input)
		: buildSessionModeContext(input);
}

function buildAiTokenEstimateRequestShape(
	input: AiTokenEstimateInput,
	mode: EstimatedAiMode,
	context: AiTokenEstimateContext,
) {
	const attachedImages = input.attachedImages || [];
	const attachedFiles = input.attachedFiles || [];
	return {
		mode,
		language: input.currentLanguage,
		modelName: input.selectedModel,
		userInstructions: input.userInstructions,
		options: {
			responseParsing: mode !== "prompt",
			...(mode === "encounter"
				? { creatureEditing: Boolean(input.editEncounterCreatures) }
				: {}),
			characterGeneration: input.generateCharacters,
			npcGeneration: input.generateNpcs,
			locationGeneration: input.generateLocations,
			encounterGeneration: input.generateEncounters,
			customMonsterGeneration: input.generateCustomMonsters,
			contextEnabled: input.useContext && !input.isBestiary,
		},
		basePrompts: {
			global: input.globalAiBasePrompt,
			campaign: input.activeCampaignBasePrompt,
		},
		context,
		attachedImages: attachedImages.map(({ name, url }) => ({ name, url })),
		attachedFiles: attachedFiles.map(({ name, mimeType, sizeBytes }) => ({
			name,
			mimeType,
			sizeBytes,
		})),
	};
}

function getAttachmentSize(file: EstimateAttachment): number {
	return Number(file.sizeBytes) || 0;
}

export function estimateAiAttachmentTokens({
	attachedFiles = [],
	attachedImages = [],
}: Pick<
	AiTokenEstimateInput,
	"attachedFiles" | "attachedImages"
>): AiAttachmentTokenEstimate {
	const imageTokens = attachedImages.length * ESTIMATED_IMAGE_TOKENS;
	const fileBytes = attachedFiles.reduce(
		(total, file) => total + getAttachmentSize(file),
		0,
	);
	return {
		imageTokens,
		fileTokens: Math.ceil(fileBytes / ESTIMATED_FILE_TOKEN_BYTES),
	};
}

export function buildAiTokenEstimate(
	input: AiTokenEstimateInput,
): AiTokenEstimate {
	const mode = getEstimatedAiMode(input);
	const context = buildAiTokenEstimateContext(input);
	const requestShape = buildAiTokenEstimateRequestShape(input, mode, context);
	const textTokens =
		(SYSTEM_TOKEN_ESTIMATES[mode] || SYSTEM_TOKEN_ESTIMATES.prompt) +
		estimateValueTokens(requestShape);
	const { imageTokens, fileTokens } = estimateAiAttachmentTokens(input);
	return {
		textTokens,
		imageTokens,
		fileTokens,
		total: textTokens + imageTokens + fileTokens,
	};
}
