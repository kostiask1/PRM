import { useEffect } from "react";

import { campaignApi } from "../../entities/campaign/index.js";
import { MentionPickerModalContent } from "../../features/editor/ui/index.js";
import { lang } from "../../shared/lib/index.js";
import { closeMentionPickerAction } from "../../shared/model/index.js";
import type { AppDispatch } from "../../shared/model/index.js";
import {
	buildAppMentionOptions,
	hasValidMentionPickerCallbacks,
	type AppMentionEntityOption,
	type AppMentionPickerCallbacks,
} from "../model/appShellPresentation.ts";
import {
	closeActiveModal,
	openModalRequest,
	useAppDispatch,
	useAppSelector,
} from "../model/index.js";

export default function MentionPickerModalHost() {
	const dispatch = useAppDispatch();
	const mentionPickerRequest = useAppSelector(
		(state) => state.mentionPickerRequest,
	);
	const { activeCampaignSlug } = useAppSelector((state) => state.navigation);
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);

	useEffect(() => {
		void runMentionPickerModalRequest(
			mentionPickerRequest,
			activeCampaignSlug,
			currentLanguage,
			dispatch,
		);
	}, [activeCampaignSlug, currentLanguage, dispatch, mentionPickerRequest]);

	return null;
}

interface MentionPickerModalContext {
	campaignSlug: string;
	callbacks: AppMentionPickerCallbacks;
}

async function runMentionPickerModalRequest(
	request: unknown,
	campaignSlug: string | null,
	currentLanguage: string,
	dispatch: AppDispatch,
): Promise<void> {
	const context = prepareMentionPickerModal(request, campaignSlug, dispatch);
	if (!context) return;
	return runMentionPickerModalWorkflow(context, currentLanguage, dispatch);
}

function prepareMentionPickerModal(
	request: unknown,
	campaignSlug: string | null,
	dispatch: AppDispatch,
): MentionPickerModalContext | null {
	if (!request) return null;
	const callbacks = getMentionPickerCallbacks(request);
	if (!callbacks) {
		closeMentionPicker(dispatch);
		return null;
	}
	if (!campaignSlug) {
		cancelMentionPicker(callbacks, dispatch);
		return null;
	}
	return { campaignSlug, callbacks };
}

function getMentionPickerCallbacks(
	request: unknown,
): AppMentionPickerCallbacks | null {
	const { select, cancel } = request as AppMentionPickerCallbacks;
	if (!hasValidMentionPickerCallbacks(request)) return null;
	return { select, cancel };
}

function closeMentionPicker(dispatch: AppDispatch): void {
	dispatch(closeMentionPickerAction());
}

function cancelMentionPicker(
	callbacks: AppMentionPickerCallbacks,
	dispatch: AppDispatch,
): void {
	const { cancel } = callbacks;
	cancel();
	closeMentionPicker(dispatch);
}

async function runMentionPickerModalWorkflow(
	context: MentionPickerModalContext,
	currentLanguage: string,
	dispatch: AppDispatch,
): Promise<void> {
	try {
		const entities = await loadMentionPickerEntities(
			context.campaignSlug,
			currentLanguage,
		);
		if (entities.length === 0) {
			cancelMentionPicker(context.callbacks, dispatch);
			return;
		}
		openMentionPickerModal(entities, context.callbacks, dispatch);
	} catch (err) {
		console.error("Error opening mention picker:", err);
		cancelMentionPicker(context.callbacks, dispatch);
	}
}

async function loadMentionPickerEntities(
	campaignSlug: string,
	currentLanguage: string,
): Promise<AppMentionEntityOption[]> {
	const [characters, npcs, locations] = await Promise.all([
		campaignApi.getEntities(campaignSlug, "characters"),
		campaignApi.getEntities(campaignSlug, "npc").catch(() => []),
		campaignApi.getEntities(campaignSlug, "locations").catch(() => []),
	]);
	return buildAppMentionOptions(
		{
			characters: characters || [],
			npc: npcs || [],
			locations: locations || [],
		},
		currentLanguage,
	);
}

function openMentionPickerModal(
	entities: AppMentionEntityOption[],
	callbacks: AppMentionPickerCallbacks,
	dispatch: AppDispatch,
): void {
	const { select } = callbacks;
	openModalRequest({
		title: lang.t("Choose mention"),
		type: "confirm",
		className: "MentionPickerModal",
		showFooter: false,
		onCancelAction: () => {
			cancelMentionPicker(callbacks, dispatch);
		},
		children: (
			<MentionPickerModalContent
				entities={entities}
				onSelect={(name) => {
					select(name);
					closeMentionPicker(dispatch);
					closeActiveModal();
				}}
				onCancel={() => {
					cancelMentionPicker(callbacks, dispatch);
					closeActiveModal();
				}}
			/>
		),
	});
}
