export interface AiAssistantContextProjectionInput {
	activeCampaign?: unknown;
	activeSession?: unknown;
	activeEncounter?: unknown;
	characters?: Record<string, unknown>[];
	npcs?: Record<string, unknown>[];
	locations?: Record<string, unknown>[];
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	parseAiResponse: boolean;
	generateEncounters: boolean;
}

export interface AiAssistantContextProjection {
	sessionName: string;
	campaignContext: {
		description: string;
		notes: Record<string, unknown>[];
	} | null;
	sessionData: Record<string, unknown>;
	isResponseParsingLocked: boolean;
	isCustomMonsterGenerationVisible: boolean;
}

type Translate = (phrase: string) => string;

export interface AiAssistantRoutePresentationInput {
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	parseAiResponse: boolean;
}

export interface AiAssistantRouteStateInput {
	isBestiary: boolean;
	navigation: {
		activeCampaignSlug?: string | null;
		activeSessionFileName?: string | null;
		activeEncounterId?: string | number | null;
	};
	imagePromptBasePrompt?: string;
	campaignAiBasePrompts?: Record<string, string>;
	campaignImagePromptBasePrompts?: Record<string, string>;
}

export interface AiAssistantRouteState {
	route: {
		campaign: string;
		session?: string | null;
		encounter?: string | number | null;
	};
	activeImagePromptBasePrompt: string;
	activeCampaignBasePrompt: string;
	isCampaign: boolean;
	isEncounter: boolean;
	historyCampaign: string;
	assetCampaignSlug: string;
	generateEncountersByDefault: boolean;
}

function getAiAssistantRoute(
	isBestiary: boolean,
	navigation: AiAssistantRouteStateInput["navigation"],
): AiAssistantRouteState["route"] {
	return {
		campaign: isBestiary
			? "bestiary"
			: navigation.activeCampaignSlug || "",
		session: navigation.activeSessionFileName,
		encounter: navigation.activeEncounterId,
	};
}

function getAiAssistantRouteTargets(
	isBestiary: boolean,
	route: AiAssistantRouteState["route"],
): Pick<
	AiAssistantRouteState,
	| "isCampaign"
	| "isEncounter"
	| "historyCampaign"
	| "assetCampaignSlug"
	| "generateEncountersByDefault"
> {
	const isCampaign = !route.session && !isBestiary;
	return {
		isCampaign,
		isEncounter: Boolean(route.encounter),
		historyCampaign: isBestiary ? "bestiary" : route.campaign,
		assetCampaignSlug: isBestiary ? "general" : route.campaign,
		generateEncountersByDefault: !isCampaign && !isBestiary,
	};
}

function getAiAssistantRoutePrompts(
	campaign: string,
	imagePromptBasePrompt: string,
	campaignAiBasePrompts: Record<string, string>,
	campaignImagePromptBasePrompts: Record<string, string>,
): Pick<
	AiAssistantRouteState,
	"activeImagePromptBasePrompt" | "activeCampaignBasePrompt"
> {
	return {
		activeImagePromptBasePrompt:
			campaignImagePromptBasePrompts[campaign] || imagePromptBasePrompt,
		activeCampaignBasePrompt: campaignAiBasePrompts[campaign] || "",
	};
}

export function getAiAssistantRouteState({
	isBestiary,
	navigation,
	imagePromptBasePrompt = "",
	campaignAiBasePrompts = {},
	campaignImagePromptBasePrompts = {},
}: AiAssistantRouteStateInput): AiAssistantRouteState {
	const route = getAiAssistantRoute(isBestiary, navigation);
	return {
		route,
		...getAiAssistantRoutePrompts(
			route.campaign,
			imagePromptBasePrompt,
			campaignAiBasePrompts,
			campaignImagePromptBasePrompts,
		),
		...getAiAssistantRouteTargets(isBestiary, route),
	};
}

export function getAiAssistantTitle(
	input: Pick<
		AiAssistantRoutePresentationInput,
		"isBestiary" | "isCampaign" | "isEncounter"
	>,
	translate: Translate,
): string {
	if (input.isBestiary) return translate("AI Bestiary Assistant");
	if (input.isCampaign) return translate("AI Story Assistant");
	if (input.isEncounter) return translate("AI Encounter Assistant");
	return translate("AI Session Assistant");
}

export function getAiAssistantPromptPlaceholder(
	input: AiAssistantRoutePresentationInput,
	translate: Translate,
): string {
	if (input.isBestiary) {
		return translate("Describe the custom creature to create...");
	}
	if (!input.parseAiResponse) {
		return translate(
			"Send your request. The response will appear in a dialog and will not change your data.",
		);
	}
	if (input.isCampaign) {
		return translate(
			"Describe changes or new plot branches (for example: 'add political intrigue' or 'make the finale more epic')...",
		);
	}
	if (input.isEncounter) {
		return translate(
			"Describe changes (for example: 'make the fight deadly', 'this is an easy skirmish', 'add guards for the boss')...",
		);
	}
	return translate(
		"Describe style or constraints (for example: 'abandoned underground city', 'detective atmosphere')...",
	);
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

const getName = (value: unknown): string => {
	const record = asRecord(value);
	return typeof record?.name === "string" ? record.name : "";
};

function getCampaignContext(
	activeCampaign: unknown,
	isBestiary: boolean,
): AiAssistantContextProjection["campaignContext"] {
	if (isBestiary) return null;
	const campaign = asRecord(activeCampaign);
	return {
		description:
			typeof campaign?.description === "string" ? campaign.description : "",
		notes: Array.isArray(campaign?.notes)
			? campaign.notes.filter(
					(note): note is Record<string, unknown> => asRecord(note) !== null,
				)
			: [],
	};
}

function getSessionData({
	activeCampaign,
	activeSession,
	activeEncounter,
	characters = [],
	npcs = [],
	locations = [],
	isBestiary,
	isCampaign,
	isEncounter,
}: AiAssistantContextProjectionInput): Record<string, unknown> {
	if (isBestiary) return {};
	if (isEncounter) return asRecord(activeEncounter) || {};
	if (isCampaign) return getCampaignSessionData(
		activeCampaign,
		characters,
		npcs,
		locations,
	);
	return getActiveSessionData(activeSession);
}

function getCampaignSessionData(
	activeCampaign: unknown,
	characters: Record<string, unknown>[],
	npcs: Record<string, unknown>[],
	locations: Record<string, unknown>[],
): Record<string, unknown> {
	return {
		...(asRecord(activeCampaign) || {}),
		characters,
		npcs,
		locations,
	};
}

function getActiveSessionData(activeSession: unknown): Record<string, unknown> {
	const session = asRecord(activeSession);
	return asRecord(session?.data) || {};
}

export function getAiAssistantContextProjection(
	input: AiAssistantContextProjectionInput,
): AiAssistantContextProjection {
	return {
		sessionName: input.isCampaign
			? getName(input.activeCampaign)
			: getName(input.activeSession),
		campaignContext: getCampaignContext(
			input.activeCampaign,
			input.isBestiary,
		),
		sessionData: getSessionData(input),
		isResponseParsingLocked: input.isBestiary,
		isCustomMonsterGenerationVisible:
			input.parseAiResponse &&
			!input.isBestiary &&
			!input.isCampaign &&
			!input.isEncounter &&
			input.generateEncounters,
	};
}
