import { useEffect } from "react";

import { campaignApi } from "../../entities/campaign/index.js";
import { sessionApi } from "../../entities/session/index.js";
import "../../assets/components/MentionPickerModalHost.css";
import { getAmbiguousMentionNames, MentionPickerModalContent } from "../../features/editor/ui/index.js";
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
	const { activeCampaignSlug, activeSessionFileName } = useAppSelector((state) => state.navigation);
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);

	useEffect(() => {
		void runMentionPickerModalRequest(
			mentionPickerRequest,
			activeCampaignSlug,
			activeSessionFileName,
			currentLanguage,
			dispatch,
		);
	}, [activeCampaignSlug, activeSessionFileName, currentLanguage, dispatch, mentionPickerRequest]);

	return null;
}

interface MentionPickerModalContext {
	campaignSlug: string;
	sessionFileName: string | null;
	callbacks: AppMentionPickerCallbacks;
}

async function runMentionPickerModalRequest(
	request: unknown,
	campaignSlug: string | null,
	sessionFileName: string | null,
	currentLanguage: string,
	dispatch: AppDispatch,
): Promise<void> {
	const context = prepareMentionPickerModal(request, campaignSlug, dispatch);
	if (!context) return;
	return runMentionPickerModalWorkflow({ ...context, sessionFileName }, currentLanguage, dispatch);
}

function prepareMentionPickerModal(
	request: unknown,
	campaignSlug: string | null,
	dispatch: AppDispatch,
): Omit<MentionPickerModalContext, "sessionFileName"> | null {
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
	const { select, cancel, query } = request as AppMentionPickerCallbacks;
	if (!hasValidMentionPickerCallbacks(request)) return null;
	return { select, cancel, query };
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
			context.sessionFileName,
		);
		if (entities.length === 0) {
			cancelMentionPicker(context.callbacks, dispatch);
			return;
		}
		const query = context.callbacks.query?.trim().toLocaleLowerCase();
		const exact = query ? entities.filter((entity) => entity.name.trim().toLocaleLowerCase() === query) : [];
		if (exact.length === 1 && !getAmbiguousMentionNames(entities).has(exact[0].name.trim().toLowerCase())) {
			context.callbacks.select(exact[0].name, context.callbacks.query);
			closeMentionPicker(dispatch);
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
	sessionFileName: string | null,
): Promise<AppMentionEntityOption[]> {
	const [characters, npcs, locations] = await Promise.all([
		campaignApi.getEntities(campaignSlug, "characters"),
		campaignApi.getEntities(campaignSlug, "npc").catch(() => []),
		campaignApi.getEntities(campaignSlug, "locations").catch(() => []),
	]);
	const session = sessionFileName ? await sessionApi.getSession(campaignSlug, sessionFileName) : null;
	const data = session?.data && typeof session.data === "object" ? session.data as Record<string, unknown> : {};
	return buildAppMentionOptions(
		{
			characters: characters || [],
			npc: [...(npcs || []), ...(Array.isArray(data.npcs) ? data.npcs.map((entity) => ({ ...entity, _mentionScope: "session" })) : [])],
			locations: [...(locations || []), ...(Array.isArray(data.locations) ? data.locations.map((entity) => ({ ...entity, _mentionScope: "session" })) : [])],
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
		className: "MentionPickerModalHost__modal",
		showFooter: false,
		onCancelAction: () => {
			cancelMentionPicker(callbacks, dispatch);
		},
		children: (
			<MentionPickerModalContent
				entities={entities}
				initialQuery={callbacks.query}
				onSelect={(name, label) => {
					select(name, label);
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
