import { useEffect, useState } from "react";

import { bestiaryApi, type BestiaryMonster } from "../../entities/bestiary/index.js";
import { campaignApi } from "../../entities/campaign/index.js";
import { sessionApi } from "../../entities/session/index.js";
import "../../assets/components/MentionPickerModalHost.css";
import {
	getAmbiguousMentionNames,
	MentionPickerModalContent,
	type BestiaryMentionOption,
} from "../../features/editor/ui/index.js";
import { lang } from "../../shared/lib/index.js";
import { Modal } from "../../shared/ui/index.js";
import { closeMentionPickerAction } from "../../shared/model/index.js";
import type { AppDispatch, ModalConfig } from "../../shared/model/index.js";
import {
	buildAppMentionOptions,
	hasValidMentionPickerCallbacks,
	type AppMentionEntityOption,
	type AppMentionPickerCallbacks,
} from "../model/appShellPresentation.ts";
import {
	useAppDispatch,
	useAppSelector,
} from "../model/index.js";

let setMentionPickerModalConfig: ((config: ModalConfig | null) => void) | null = null;

function openModalRequest(config: ModalConfig): void {
	setMentionPickerModalConfig?.(config);
}

function closeActiveModal(): void {
	setMentionPickerModalConfig?.(null);
}

export default function MentionPickerModalHost() {
	const dispatch = useAppDispatch();
	const mentionPickerRequest = useAppSelector(
		(state) => state.mentionPickerRequest,
	);
	const { activeCampaignSlug, activeSessionFileName } = useAppSelector((state) => state.navigation);
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
	setMentionPickerModalConfig = setModalConfig;

	useEffect(() => {
		void runMentionPickerModalRequest(
			mentionPickerRequest,
			activeCampaignSlug,
			activeSessionFileName,
			currentLanguage,
			dispatch,
		);
	}, [activeCampaignSlug, activeSessionFileName, currentLanguage, dispatch, mentionPickerRequest]);

	if (modalConfig) {
		const cancelAction = modalConfig.onCancelAction;
		return (
			<Modal
				{...modalConfig}
				onConfirm={() => closeActiveModal()}
				onCancel={() => {
					if (typeof cancelAction === "function") cancelAction();
					closeActiveModal();
				}}
			/>
		);
	}

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
	if (Boolean((request as AppMentionPickerCallbacks | null)?.includeBestiary)) {
		return runMentionPickerModalWorkflow(
			{
				...context,
				callbacks: { ...context.callbacks, includeBestiary: true },
				sessionFileName,
			},
			currentLanguage,
			dispatch,
		);
	}
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
		if (
			shouldIncludeBestiaryMentions(
				(request as AppMentionPickerCallbacks | null)?.includeBestiary,
			)
		) {
			return { campaignSlug: "", callbacks };
		}
		cancelMentionPicker(callbacks, dispatch);
		return null;
	}
	return { campaignSlug, callbacks };
}

let cachedOfficialBestiaryPromise: Promise<BestiaryMentionOption[]> | null = null;

function hasBestiaryCommandInActiveEditor(): boolean {
	if (typeof document === "undefined") return false;
	const active = document.activeElement as HTMLElement | null;
	if (!active) return false;
	let text = "";
	if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
		text = active.value || "";
	} else {
		const editable = active.closest?.('[contenteditable="true"]');
		text = editable?.textContent || active.textContent || "";
	}
	return /(^|\s)@bestiary\b/i.test(text);
}

function shouldIncludeBestiaryMentions(includeBestiary?: boolean): boolean {
	if (includeBestiary) return true;
	if (typeof document === "undefined") return false;
	return Boolean(document.querySelector(".Bestiary")) || hasBestiaryCommandInActiveEditor();
}

function toBestiaryMentionOption(
	monster: BestiaryMonster,
): BestiaryMentionOption | null {
	const name = String(monster?.name || "").trim();
	if (!name) return null;
	const source = String(monster?.source || "").trim();
	const rawCr = monster?.cr;
	const cr =
		typeof rawCr === "object" && rawCr !== null && "cr" in rawCr
			? String((rawCr as { cr?: unknown }).cr ?? "").trim()
			: String(rawCr ?? "").trim();
	return { ...monster, name, source, cr: cr || undefined };
}

function getOfficialBestiaryOptions(): Promise<BestiaryMentionOption[]> {
	if (!cachedOfficialBestiaryPromise) {
		cachedOfficialBestiaryPromise = bestiaryApi
			.getBestiaryData("all")
			.then((list) =>
				(Array.isArray(list) ? list : [])
					.map(toBestiaryMentionOption)
					.filter((item): item is BestiaryMentionOption => Boolean(item)),
			)
			.catch(() => []);
	}
	return cachedOfficialBestiaryPromise;
}

async function loadMentionPickerBestiary(): Promise<BestiaryMentionOption[]> {
	const [official, custom] = await Promise.all([
		getOfficialBestiaryOptions(),
		bestiaryApi
			.getCustomBestiaryData()
			.then((list) =>
				(Array.isArray(list) ? list : [])
					.map(toBestiaryMentionOption)
					.filter((item): item is BestiaryMentionOption => Boolean(item)),
			)
			.catch(() => []),
	]);
	const seen = new Set<string>();
	const combined: BestiaryMentionOption[] = [];
	for (const item of [...custom, ...official]) {
		const key = `${item.name.toLowerCase()}|${(item.source || "").toUpperCase()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		combined.push(item);
	}
	return combined;
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
		const includeBestiary = shouldIncludeBestiaryMentions(
			context.callbacks.includeBestiary,
		);
		const entities = await loadMentionPickerEntities(
			context.campaignSlug,
			currentLanguage,
			context.sessionFileName,
		);
		const bestiaryMonsters = includeBestiary
			? await loadMentionPickerBestiary()
			: [];
		if (bestiaryMonsters.length === 0) {
			if (entities.length === 0) {
				cancelMentionPicker(context.callbacks, dispatch);
				return;
			}
		}
		const query = context.callbacks.query?.trim().toLocaleLowerCase();
		const exact = query ? entities.filter((entity) => entity.name.trim().toLocaleLowerCase() === query) : [];
		const exactBestiary = query
			? bestiaryMonsters.filter(
					(monster) => monster.name.trim().toLocaleLowerCase() === query,
				)
			: [];
		if (
			exact.length === 1 &&
			exactBestiary.length === 0 &&
			!getAmbiguousMentionNames(entities).has(exact[0].name.trim().toLowerCase())
		) {
			context.callbacks.select(exact[0].name, context.callbacks.query);
			closeMentionPicker(dispatch);
			return;
		}
		if (
			bestiaryMonsters.length > 0 &&
			entities.length === 0 &&
			exactBestiary.length === 1
		) {
			context.callbacks.select(exactBestiary[0].name, context.callbacks.query);
			closeMentionPicker(dispatch);
			return;
		}
		if (bestiaryMonsters.length > 0) {
			openMentionPickerModal(
				entities,
				context.callbacks,
				dispatch,
				bestiaryMonsters,
			);
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
	if (!campaignSlug) return [];
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
	bestiaryMonsters: BestiaryMentionOption[] = [],
): void {
	const { select } = callbacks;
	openModalRequest({
		title: lang.t("Choose mention"),
		type: "confirm",
		className: "MentionPickerModalHost__modal",
		showFooter: false,
		zIndex: 1450,
		onCancelAction: () => {
			cancelMentionPicker(callbacks, dispatch);
		},
		children: (
			<MentionPickerModalContent
				entities={entities}
				bestiaryMonsters={bestiaryMonsters}
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
