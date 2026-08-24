import type { BestiaryFavorite } from "../../../entities/bestiary/index.js";

interface BestiarySyncMonsterReference {
	name: string;
	source: string;
}

export interface BestiarySyncEvent {
	version: string | number;
	resource: string;
	monsterName?: string;
	monsterSource?: string;
}

export interface BestiarySyncEventPlan {
	pendingSelection: BestiarySyncMonsterReference | null;
	refreshFavorites: true;
	reloadMonsters: boolean;
	suppressAutoSelection: boolean;
}

export interface ExecuteBestiarySyncEventPlanOptions {
	plan: BestiarySyncEventPlan | null | undefined;
	refreshFavorites(): Promise<BestiaryFavorite[] | null | undefined>;
	onFavorites(favorites: BestiaryFavorite[]): void;
	onRefreshError(error: unknown): void;
	onPendingSelection(selection: BestiarySyncMonsterReference): void;
	onSuppressAutoSelection(): void;
	onReloadMonsters(): void;
}

export interface BestiarySyncEventExecution {
	favoritesRefresh: Promise<void>;
}

export type BestiarySelectedSourcesSaveOutcome =
	| {
			status: "succeeded";
			scope: "campaign" | "global";
			ignoreSourcesList: string[];
	  }
	| { status: "failed"; error: unknown; ignoreSourcesList: string[] };

export interface ExecuteBestiarySelectedSourcesSaveOptions {
	filterSourceOptions: string[];
	nextSelectedSources: string[];
	activeCampaignSlug: string | null;
	getIgnoreSourcesList(
		filterSourceOptions: string[],
		nextSelectedSources: string[],
	): string[];
	onEnableAutoSelection(): void;
	updateCampaign(
		slug: string,
		payload: { ignoreSourcesList: string[] },
	): Promise<unknown>;
	listCampaigns(): Promise<unknown[] | null | undefined>;
	onCampaigns(campaigns: unknown[]): void;
	updateSettings(payload: {
		ignoreSourcesList: string[];
	}): Promise<Record<string, unknown> | null>;
	onUiIgnoreSources(ignoreSourcesList: string[]): void;
	onLogError(error: unknown): void;
	onError(error: unknown): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getBestiarySourceCandidate(source: Record<string, unknown>): unknown {
	return source.value ?? source.source ?? source.id ?? source.name;
}

function getBestiarySourceCode(source: unknown): string {
	if (typeof source === "string") return source;
	if (!isRecord(source)) return "";
	const candidate = getBestiarySourceCandidate(source);
	return typeof candidate === "string" ? candidate : "";
}

export function getBestiarySourceCodes(data: unknown): string[] {
	if (!Array.isArray(data)) return [];
	return data.map(getBestiarySourceCode).filter(Boolean);
}

type BestiarySyncEventRequiredFields = Pick<
	BestiarySyncEvent,
	"resource" | "version"
>;

function getBestiarySyncEventVersion(value: unknown): string | number | null {
	return typeof value === "string" || typeof value === "number" ? value : null;
}

function getBestiarySyncEventRequiredFields(
	value: Record<string, unknown>,
): BestiarySyncEventRequiredFields | null {
	if (typeof value.resource !== "string") return null;
	const version = getBestiarySyncEventVersion(value.version);
	if (version === null) return null;
	return { resource: value.resource, version };
}

function getOptionalBestiarySyncEventString(
	value: Record<string, unknown>,
	key: "monsterName" | "monsterSource",
): string | undefined {
	return typeof value[key] === "string" ? value[key] : undefined;
}

export function parseBestiarySyncEvent(value: unknown): BestiarySyncEvent | null {
	if (!isRecord(value)) return null;
	const required = getBestiarySyncEventRequiredFields(value);
	if (!required) return null;
	return {
		...required,
		monsterName: getOptionalBestiarySyncEventString(value, "monsterName"),
		monsterSource: getOptionalBestiarySyncEventString(value, "monsterSource"),
	};
}

function isSupportedBestiarySyncEvent(
	event: BestiarySyncEvent | null | undefined,
): event is BestiarySyncEvent {
	return Boolean(
		event?.version &&
			["bestiary", "custom-bestiary", "ai"].includes(event.resource),
	);
}

function shouldReloadBestiaryMonsters(resource: string): boolean {
	return resource === "custom-bestiary" || resource === "ai";
}

function getBestiarySyncPendingSelection(
	event: BestiarySyncEvent,
	reloadMonsters: boolean,
): BestiarySyncMonsterReference | null {
	if (!reloadMonsters || !event.monsterName) return null;
	return {
		name: event.monsterName,
		source: event.monsterSource || "CUSTOM",
	};
}

export function getBestiarySyncEventPlan(
	event: BestiarySyncEvent | null | undefined,
): BestiarySyncEventPlan | null {
	if (!isSupportedBestiarySyncEvent(event)) return null;
	const reloadMonsters = shouldReloadBestiaryMonsters(event.resource);
	const pendingSelection = getBestiarySyncPendingSelection(
		event,
		reloadMonsters,
	);
	return {
		pendingSelection,
		refreshFavorites: true,
		reloadMonsters,
		suppressAutoSelection: Boolean(pendingSelection),
	};
}

function startBestiaryFavoritesRefresh(
	options: ExecuteBestiarySyncEventPlanOptions,
): Promise<void> {
	return options
		.refreshFavorites()
		.then((favorites) => options.onFavorites(favorites ?? []))
		.catch((error: unknown) => options.onRefreshError(error));
}

function applyBestiarySyncPendingSelection(
	plan: BestiarySyncEventPlan,
	onPendingSelection: (selection: BestiarySyncMonsterReference) => void,
): void {
	if (plan.pendingSelection) onPendingSelection(plan.pendingSelection);
}

function applyBestiarySyncAutoSelectionSuppression(
	plan: BestiarySyncEventPlan,
	onSuppressAutoSelection: () => void,
): void {
	if (plan.suppressAutoSelection) onSuppressAutoSelection();
}

function applyBestiarySyncReload(
	plan: BestiarySyncEventPlan,
	onReloadMonsters: () => void,
): void {
	if (plan.reloadMonsters) onReloadMonsters();
}

export function executeBestiarySyncEventPlan(
	options: ExecuteBestiarySyncEventPlanOptions,
): BestiarySyncEventExecution | null {
	const plan = options.plan;
	if (!plan) return null;
	const favoritesRefresh = startBestiaryFavoritesRefresh(options);
	applyBestiarySyncPendingSelection(plan, options.onPendingSelection);
	applyBestiarySyncAutoSelectionSuppression(
		plan,
		options.onSuppressAutoSelection,
	);
	applyBestiarySyncReload(plan, options.onReloadMonsters);
	return { favoritesRefresh };
}

async function saveCampaignBestiarySelectedSources(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
	campaignSlug: string,
	ignoreSourcesList: string[],
): Promise<"campaign"> {
	await options.updateCampaign(campaignSlug, { ignoreSourcesList });
	const campaigns = await options.listCampaigns();
	options.onCampaigns(campaigns ?? []);
	return "campaign";
}

function getSavedBestiaryIgnoreSources(
	saved: Record<string, unknown> | null,
	requested: string[],
): string[] {
	return Array.isArray(saved?.ignoreSourcesList)
		? (saved.ignoreSourcesList as string[])
		: requested;
}

async function saveGlobalBestiarySelectedSources(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
	ignoreSourcesList: string[],
): Promise<"global"> {
	const saved = await options.updateSettings({ ignoreSourcesList });
	options.onUiIgnoreSources(
		getSavedBestiaryIgnoreSources(saved, ignoreSourcesList),
	);
	return "global";
}

function saveBestiarySelectedSources(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
	ignoreSourcesList: string[],
): Promise<"campaign" | "global"> {
	return options.activeCampaignSlug
		? saveCampaignBestiarySelectedSources(
				options,
				options.activeCampaignSlug,
				ignoreSourcesList,
			)
		: saveGlobalBestiarySelectedSources(options, ignoreSourcesList);
}

export async function executeBestiarySelectedSourcesSave(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
): Promise<BestiarySelectedSourcesSaveOutcome> {
	const ignoreSourcesList = options.getIgnoreSourcesList(
		options.filterSourceOptions,
		options.nextSelectedSources,
	);
	options.onEnableAutoSelection();
	try {
		const scope = await saveBestiarySelectedSources(options, ignoreSourcesList);
		return { status: "succeeded", scope, ignoreSourcesList };
	} catch (error) {
		options.onLogError(error);
		options.onError(error);
		return { status: "failed", error, ignoreSourcesList };
	}
}
