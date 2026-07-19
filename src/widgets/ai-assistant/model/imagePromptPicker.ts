export type ImagePromptEntity = Record<string, unknown> & {
	id?: string | number;
	slug?: string;
	name?: string;
	title?: string;
	type?: unknown;
	cr?: unknown;
	description?: unknown;
	trait?: unknown;
	motivation?: unknown;
	_imagePromptSessionFileName?: string;
	_imagePromptSessionName?: string;
	_imagePromptIndex?: number;
	imageUrl?: string;
};

export interface ImagePromptSession extends ImagePromptEntity {
	fileName?: string;
	data?: {
		scenes?: ImagePromptEntity[];
		encounters?: Record<string, unknown>[];
		[key: string]: unknown;
	};
}

export interface AiImagePromptCollectionsInput {
	isCampaign: boolean;
	currentLanguage?: string;
	sessionData?: Record<string, unknown> | null;
	sessionName?: string;
	sessionFileName?: string;
	npcs?: ImagePromptEntity[];
	locations?: ImagePromptEntity[];
	sessions?: ImagePromptSession[];
	customMonsters?: ImagePromptEntity[];
}

export interface AiImagePromptCollections {
	npcs: ImagePromptEntity[];
	locations: ImagePromptEntity[];
	scenes: ImagePromptEntity[];
	customMonstersWithoutImages: ImagePromptEntity[];
	customMonstersWithImages: ImagePromptEntity[];
}

export interface AiImagePromptGenerationPlan {
	errorKey: "Image prompt instructions are required when no element is selected." | null;
	targetSceneId: string | number | null;
	options: {
		imageTarget: ImagePromptTarget | null;
		imagePromptBasePromptOverride: string;
		userInstructionsOverride: string;
	};
}

export interface ImagePromptTarget extends Record<string, unknown> {
	type: "npc" | "location" | "scene" | "custom-monster";
	id: string | number;
	name: string;
	sessionName?: string;
}

export interface ImagePromptPickerStateInput {
	selectedTarget?: ImagePromptTarget | null;
	isContextMode?: boolean;
	loading?: boolean;
	request?: unknown;
}

export interface ImagePromptPickerState {
	isDetailsVisible: boolean;
	instructionsRequired: boolean;
	canGenerate: boolean;
	titleKey:
		| "Image prompt"
		| "Choose an element to generate a prompt";
}

export function getImagePromptPickerState({
	selectedTarget,
	isContextMode = false,
	loading = false,
	request,
}: ImagePromptPickerStateInput): ImagePromptPickerState {
	const isDetailsVisible = Boolean(selectedTarget || isContextMode);
	const instructionsRequired = Boolean(isContextMode);
	return {
		isDetailsVisible,
		instructionsRequired,
		canGenerate:
			!loading &&
			(!instructionsRequired || String(request || "").trim().length > 0),
		titleKey: isDetailsVisible
			? "Image prompt"
			: "Choose an element to generate a prompt",
	};
}

export function getImagePromptItemKey(
	item: ImagePromptEntity,
	index: number,
	title: string,
	preferredKey?: unknown,
): string {
	return String(
		preferredKey || item.id || item.slug || `${title}-${index}`,
	);
}

export function getCustomMonsterPromptDescription(
	monster: ImagePromptEntity,
): string {
	return [monster.type, monster.cr ? `CR ${String(monster.cr)}` : ""]
		.filter(Boolean)
		.join(" - ");
}

export function getScenePromptItemKey(
	scene: ImagePromptEntity,
	index: number,
): string {
	return [scene._imagePromptSessionFileName, scene.id, index]
		.filter(Boolean)
		.join(":");
}

export function getScenePromptDescription(
	scene: ImagePromptEntity,
	description: unknown,
): string {
	return [scene._imagePromptSessionName, description]
		.filter(Boolean)
		.join(" - ");
}

const asEntities = (value: unknown): ImagePromptEntity[] =>
	Array.isArray(value)
		? value.filter(
				(item): item is ImagePromptEntity =>
					Boolean(item) && typeof item === "object" && !Array.isArray(item),
			)
		: [];

function getCampaignEntities(
	sessionData: Record<string, unknown>,
	key: "npcs" | "locations",
	fallback: ImagePromptEntity[],
): ImagePromptEntity[] {
	const scoped = asEntities(sessionData[key]);
	return scoped.length > 0 ? scoped : fallback;
}

function getCampaignScenes(sessions: ImagePromptSession[]): ImagePromptEntity[] {
	return sessions.flatMap((session) =>
		asEntities(session.data?.scenes).map((scene, index) => ({
			...scene,
			_imagePromptSessionName: session.name,
			_imagePromptSessionFileName: session.fileName,
			_imagePromptIndex: index,
			_imagePromptEncounters: asEntities(session.data?.encounters),
		})),
	);
}

function getSessionScenes(
	sessionData: Record<string, unknown>,
	sessionName: string,
	sessionFileName?: string,
): ImagePromptEntity[] {
	const encounters = asEntities(sessionData.encounters);
	return asEntities(sessionData.scenes).map((scene, index) => ({
		...scene,
		_imagePromptSessionName:
			sessionName || (typeof sessionData.name === "string" ? sessionData.name : ""),
		_imagePromptSessionFileName: sessionFileName,
		_imagePromptIndex: index,
		_imagePromptEncounters: encounters,
	}));
}

export function getAiImagePromptCollections({
	isCampaign,
	currentLanguage = "en",
	sessionData = {},
	sessionName = "",
	sessionFileName,
	npcs = [],
	locations = [],
	sessions = [],
	customMonsters = [],
}: AiImagePromptCollectionsInput): AiImagePromptCollections {
	const data = sessionData || {};
	const sortedMonsters = [...customMonsters].sort((first, second) =>
		String(first.name || "").localeCompare(
			String(second.name || ""),
			currentLanguage,
		),
	);
	return {
		npcs: isCampaign ? getCampaignEntities(data, "npcs", npcs) : asEntities(data.npcs),
		locations: isCampaign
			? getCampaignEntities(data, "locations", locations)
			: asEntities(data.locations),
		scenes: isCampaign
			? getCampaignScenes(sessions)
			: getSessionScenes(data, sessionName, sessionFileName),
		customMonstersWithoutImages: sortedMonsters.filter(
			(monster) => !monster.imageUrl,
		),
		customMonstersWithImages: sortedMonsters.filter(
			(monster) => Boolean(monster.imageUrl),
		),
	};
}

export function buildAiImagePromptGenerationPlan(
	target: ImagePromptTarget | null,
	instructions: string,
	request: string,
): AiImagePromptGenerationPlan {
	const normalizedRequest = request.trim();
	return {
		errorKey:
			!target && !normalizedRequest
				? "Image prompt instructions are required when no element is selected."
				: null,
		targetSceneId:
			target?.type === "scene" ? target.id || null : null,
		options: {
			imageTarget: target,
			imagePromptBasePromptOverride: instructions.trim(),
			userInstructionsOverride: target ? "" : normalizedRequest,
		},
	};
}

export function getImagePromptTargetTitle(
	target: ImagePromptTarget | null | undefined,
): string {
	if (!target) return "";
	if (target.type === "scene" && target.sessionName) {
		return `${target.name} - ${target.sessionName}`;
	}
	return String(target.name || target.id || target.type || "");
}
