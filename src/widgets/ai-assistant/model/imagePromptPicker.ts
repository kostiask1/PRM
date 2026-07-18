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
};

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
