import { useCallback, useEffect } from "react";
import {
	buildCustomMonsterImageTarget,
	buildLocationImageTarget,
	buildNpcImageTarget,
	buildSceneImageTarget,
} from "../../../features/ai/index.js";
import {
	buildAiImagePromptGenerationPlan,
	getAiImagePromptCollections,
	getImagePromptTargetTitle,
	type AiImagePromptCollections,
	type ImagePromptEntity,
	type ImagePromptSession,
	type ImagePromptTarget,
} from "./imagePromptPicker.ts";
import type { AiImagePromptState } from "./useAiImagePromptState.ts";

interface ImagePromptGenerateOptions {
	imageTarget: ImagePromptTarget | null;
	imagePromptBasePromptOverride: string;
	userInstructionsOverride: string;
}

export interface UseAiImagePromptControllerOptions {
	state: AiImagePromptState;
	activeBasePrompt: string;
	currentLanguage?: string;
	isBestiary: boolean;
	isCampaign: boolean;
	sessionData?: Record<string, unknown> | null;
	sessionName?: string;
	sessionFileName?: string;
	npcs?: ImagePromptEntity[];
	locations?: ImagePromptEntity[];
	sessions?: ImagePromptSession[];
	customMonsters?: ImagePromptEntity[];
	prepareData(): Promise<unknown>;
	generate(
		type: string,
		targetSceneId: string | number | null,
		options: ImagePromptGenerateOptions,
	): unknown;
	setError(message: string): void;
	translate(key: string): string;
	getCharacterDisplayName(entity: ImagePromptEntity): string;
	getLocationDisplayName(entity: ImagePromptEntity): string;
	getSceneTitle(scene: ImagePromptEntity, index: number): string;
	onRegisterAction?: (
		action: ((monster: ImagePromptEntity) => void) | null,
	) => void;
}

export interface AiImagePromptController extends AiImagePromptCollections {
	buildCustomMonsterTarget: typeof buildCustomMonsterImageTarget;
	buildLocationTarget(entity: ImagePromptEntity): ImagePromptTarget;
	buildNpcTarget(entity: ImagePromptEntity): ImagePromptTarget;
	buildSceneTarget(entity: ImagePromptEntity): ImagePromptTarget;
	getTargetTitle: typeof getImagePromptTargetTitle;
	onBackToSelection(): void;
	onCancel(): void;
	onContinueWithoutSelection(): void;
	onGenerate(target?: ImagePromptTarget | null): void;
	onOpen(): Promise<void>;
	onSelectTarget(target: ImagePromptTarget): void;
}

function resetImagePromptState(state: AiImagePromptState): void {
	state.setSelectedTarget(null);
	state.setInstructions("");
	state.setRequest("");
	state.setIsContextMode(false);
}

function prepareSelectionState(
	state: AiImagePromptState,
	basePrompt: string,
	isContextMode: boolean,
): void {
	state.setSelectedTarget(null);
	state.setIsContextMode(isContextMode);
	state.setInstructions(basePrompt);
	state.setRequest("");
}

export function useAiImagePromptController({
	state,
	activeBasePrompt,
	currentLanguage,
	isBestiary,
	isCampaign,
	sessionData,
	sessionName,
	sessionFileName,
	npcs,
	locations,
	sessions,
	customMonsters,
	prepareData,
	generate,
	setError,
	translate,
	getCharacterDisplayName,
	getLocationDisplayName,
	getSceneTitle,
	onRegisterAction,
}: UseAiImagePromptControllerOptions): AiImagePromptController {
	const {
		setInstructions,
		setIsContextMode,
		setIsOpen,
		setRequest,
		setSelectedTarget,
	} = state;
	const collections = getAiImagePromptCollections({
		isCampaign,
		currentLanguage,
		sessionData,
		sessionName,
		sessionFileName,
		npcs,
		locations,
		sessions,
		customMonsters,
	});
	const scope = isCampaign ? "campaign" : "session";
	const buildNpcTarget = (entity: ImagePromptEntity) =>
		buildNpcImageTarget(entity, {
			displayName: getCharacterDisplayName(entity),
			scope,
		});
	const buildLocationTarget = (entity: ImagePromptEntity) =>
		buildLocationImageTarget(entity, {
			displayName: getLocationDisplayName(entity),
			scope,
		});
	const buildSceneTarget = (entity: ImagePromptEntity) =>
		buildSceneImageTarget(entity, {
			title: getSceneTitle(entity, entity._imagePromptIndex || 0),
		});

	const onGenerate = (target: ImagePromptTarget | null = null) => {
		const plan = buildAiImagePromptGenerationPlan(
			target,
			state.instructions,
			state.request,
		);
		if (plan.errorKey) {
			setError(translate(plan.errorKey));
			return;
		}
		state.setIsOpen(false);
		generate("image", plan.targetSceneId, plan.options);
		resetImagePromptState(state);
	};
	const onSelectTarget = (target: ImagePromptTarget) => {
		state.setSelectedTarget(target);
		state.setIsContextMode(false);
		state.setInstructions(activeBasePrompt);
	};
	const onContinueWithoutSelection = () =>
		prepareSelectionState(state, activeBasePrompt, true);
	const onBackToSelection = () =>
		prepareSelectionState(state, activeBasePrompt, false);
	const onCancel = () => {
		state.setIsOpen(false);
		resetImagePromptState(state);
	};
	const onOpen = async () => {
		prepareSelectionState(state, activeBasePrompt, false);
		await prepareData();
		state.setIsOpen(true);
	};
	const openForMonster = useCallback(
		(monster: ImagePromptEntity) => {
			if (!monster.name) return;
			setSelectedTarget(buildCustomMonsterImageTarget(monster));
			setIsContextMode(false);
			setInstructions(activeBasePrompt);
			setRequest("");
			setIsOpen(true);
		},
		[
			activeBasePrompt,
			setInstructions,
			setIsContextMode,
			setIsOpen,
			setRequest,
			setSelectedTarget,
		],
	);

	useEffect(() => {
		if (!isBestiary || typeof onRegisterAction !== "function") return undefined;
		onRegisterAction(openForMonster);
		return () => onRegisterAction(null);
	}, [isBestiary, onRegisterAction, openForMonster]);

	return {
		...collections,
		buildCustomMonsterTarget: buildCustomMonsterImageTarget,
		buildLocationTarget,
		buildNpcTarget,
		buildSceneTarget,
		getTargetTitle: getImagePromptTargetTitle,
		onBackToSelection,
		onCancel,
		onContinueWithoutSelection,
		onGenerate,
		onOpen,
		onSelectTarget,
	};
}
