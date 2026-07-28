import {
	makeDomId,
	mapWithConcurrency,
} from "../../../shared/lib/index.js";

export const CAMPAIGN_SEARCH_FILTERS = ["notes", "scenes", "npc", "locations"] as const;
export const CAMPAIGN_SEARCH_RESULT_LIMIT = 80;
export const CAMPAIGN_SEARCH_SESSION_LOAD_CONCURRENCY = 6;
export type CampaignSearchFilter = (typeof CAMPAIGN_SEARCH_FILTERS)[number];

export interface CampaignSearchTarget {
	campaignSlug: string;
	sessionFileName?: string | null;
	encounterId?: string | number | null;
	hash?: string;
}

export interface CampaignSearchResult {
	id: string;
	filter: CampaignSearchFilter;
	title: string;
	subtitle: string;
	text: string;
	target: CampaignSearchTarget;
	searchText: string;
}

export interface CampaignSearchRecord extends Record<string, unknown> {
	id?: string | number;
	slug?: string;
	fileName?: string;
	name?: string;
	title?: string;
	firstName?: string;
	lastName?: string;
	notes?: CampaignSearchRecord[];
}

export interface CampaignSearchCampaign extends CampaignSearchRecord {
	slug: string;
	name: string;
	description?: string;
	characters?: CampaignSearchRecord[];
	npcs?: CampaignSearchRecord[];
	locations?: CampaignSearchRecord[];
}

export interface CampaignSearchEntities {
	characters: CampaignSearchRecord[];
	npc: CampaignSearchRecord[];
	locations: CampaignSearchRecord[];
}

export interface CampaignSearchSession extends CampaignSearchRecord {
	detail?: CampaignSearchRecord;
	data?: CampaignSearchRecord;
}

export type CampaignSearchTranslate = (
	key: string,
	params?: Record<string, string | number>,
) => string;

export interface CampaignSearchApi {
	getEntities(
		slug: string,
		type: string,
		options?: RequestInit,
	): Promise<unknown>;
	listSessions(slug: string, options?: RequestInit): Promise<unknown>;
	getSession(
		slug: string,
		fileName: string,
		options?: RequestInit,
	): Promise<unknown>;
}

function asRecord(value: unknown): CampaignSearchRecord {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as CampaignSearchRecord)
		: {};
}

export function normalizeCampaignSearchRecords(value: unknown): CampaignSearchRecord[] {
	return Array.isArray(value) ? value.map(asRecord) : [];
}

type CampaignSearchValueKind = "empty" | "scalar" | "array" | "record" | "ignored";

const CAMPAIGN_SEARCH_VALUE_KIND_BY_TYPE: Partial<Record<string, CampaignSearchValueKind>> = {
	string: "scalar",
	number: "scalar",
	object: "record",
};

function getCampaignSearchValueKind(value: unknown): CampaignSearchValueKind {
	if ([value === null, value === undefined].includes(true)) return "empty";
	if (Array.isArray(value)) return "array";
	return CAMPAIGN_SEARCH_VALUE_KIND_BY_TYPE[typeof value] ?? "ignored";
}

function isSearchableCampaignEntry([key]: [string, unknown]): boolean {
	return [!key.startsWith("_"), key !== "imageUrl"].every(Boolean);
}

function getCampaignSearchArrayText(value: unknown): string {
	return (value as unknown[]).map(campaignSearchValueToText).join("\n");
}

function getCampaignSearchRecordText(value: unknown): string {
	return Object.entries(value as Record<string, unknown>)
		.filter(isSearchableCampaignEntry)
		.map(([, item]) => campaignSearchValueToText(item))
		.join("\n");
}

const CAMPAIGN_SEARCH_VALUE_READERS: Record<CampaignSearchValueKind, (value: unknown) => string> = {
	empty: () => "",
	scalar: (value) => String(value),
	array: getCampaignSearchArrayText,
	record: getCampaignSearchRecordText,
	ignored: () => "",
};

export function campaignSearchValueToText(value: unknown): string {
	return CAMPAIGN_SEARCH_VALUE_READERS[getCampaignSearchValueKind(value)](value);
}

export function normalizeCampaignSearchText(value: unknown): string {
	return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function getCampaignSearchHighlightTerms(query: unknown): string[] {
	return [...new Set(String(query || "").trim().split(/\s+/).map((term) => term.trim()).filter((term) => term.length >= 2))];
}

export function getCampaignSearchResultTitle(value: unknown): string {
	return String(value || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function getCampaignSearchSnippetIndex(source: string, normalizedQuery: string): number {
	if (!normalizedQuery) return -1;
	return normalizeCampaignSearchText(source).indexOf(normalizedQuery);
}

function getCampaignSearchEllipsis(show: boolean): string {
	return ["", "..."][Number(show)];
}

export function buildCampaignSearchSnippet(text: unknown, query: unknown): string {
	const source = String(text || "").replace(/\s+/g, " ").trim();
	if (!source) return "";
	const normalizedQuery = normalizeCampaignSearchText(query);
	const index = getCampaignSearchSnippetIndex(source, normalizedQuery);
	const start = Math.max(0, index - 70);
	const snippet = source.slice(start, start + 180);
	const prefix = getCampaignSearchEllipsis(start > 0);
	const suffix = getCampaignSearchEllipsis(start + 180 < source.length);
	return `${prefix}${snippet}${suffix}`;
}

function getEntityName(entity: CampaignSearchRecord, fallback: string, untitled: string): string {
	const fullName = [entity.firstName, entity.lastName]
		.map(stringifyTruthyCampaignSearchValue)
		.filter(Boolean)
		.join(" ")
		.trim();
	const candidates = [fullName, entity.name, entity.title, fallback]
		.map(stringifyTruthyCampaignSearchValue);
	return candidates.find(Boolean) ?? String(untitled);
}

function stringifyTruthyCampaignSearchValue(value: unknown): string {
	return value ? String(value) : "";
}

function pushResult(results: CampaignSearchResult[], item: Omit<CampaignSearchResult, "searchText">): void {
	results.push({ ...item, searchText: normalizeCampaignSearchText([item.title, item.subtitle, item.text].join("\n")) });
}

interface NoteOptions {
	idPrefix: string;
	subtitle: string;
	target: CampaignSearchTarget;
}

function pushNote(results: CampaignSearchResult[], note: CampaignSearchRecord, options: NoteOptions): void {
	const title = String(note.title || "").trim();
	pushResult(results, {
		id: `${options.idPrefix}:${String(note.id || title || "note")}`,
		filter: "notes",
		title,
		subtitle: options.subtitle,
		text: [note.title, note.text].filter(Boolean).join("\n"),
		target: options.target,
	});
}

interface EntityOptions extends NoteOptions {
	filter: Extract<CampaignSearchFilter, "npc" | "locations">;
	title: (entity: CampaignSearchRecord) => string;
}

function pushEntity(results: CampaignSearchResult[], entity: CampaignSearchRecord, options: EntityOptions): void {
	const title = options.title(entity);
	const notes = normalizeCampaignSearchRecords(entity.notes);
	pushResult(results, {
		id: `${options.idPrefix}:${String(entity.id || entity.slug || title)}`,
		filter: options.filter,
		title,
		subtitle: options.subtitle,
		text: [title, entity.race, entity.class, entity.motivation, entity.description, entity.trait, campaignSearchValueToText(notes)].join("\n"),
		target: options.target,
	});
	notes.forEach((note, index) => pushNote(results, note, {
		idPrefix: `${options.idPrefix}:${String(entity.id || index)}:note`,
		subtitle: `${options.subtitle} · ${title}`,
		target: options.target,
	}));
}

export function buildCampaignSearchIndex(
	input: { campaign: CampaignSearchCampaign; entities: CampaignSearchEntities; sessions: CampaignSearchSession[] },
	translate: CampaignSearchTranslate,
): CampaignSearchResult[] {
	const { campaign, entities, sessions } = input;
	const results: CampaignSearchResult[] = [];
	const campaignTarget = { campaignSlug: campaign.slug };
	const untitled = translate("Untitled");
	const entityName = (entity: CampaignSearchRecord) => getEntityName(entity, "", untitled);
	const locationName = (location: CampaignSearchRecord) => String(location.name || location.title || untitled);

	pushResult(results, { id: "campaign-description", filter: "notes", title: translate("Campaign description"), subtitle: campaign.name, text: campaign.description || "", target: { ...campaignTarget, hash: makeDomId("campaign", "description") } });
	normalizeCampaignSearchRecords(campaign.notes).forEach((note, index) => pushNote(results, note, { idPrefix: `campaign-note-${String(note.id || index)}`, subtitle: `${campaign.name} · ${translate("Campaign notes")}`, target: { ...campaignTarget, hash: makeDomId("campaign", "note", note.id || index) } }));
	entities.characters.forEach((entity) => pushEntity(results, entity, { filter: "npc", idPrefix: "campaign-character", subtitle: translate("Character"), title: entityName, target: { ...campaignTarget, hash: makeDomId("campaign", "character", entity.id || entity.slug) } }));
	entities.npc.forEach((entity) => pushEntity(results, entity, { filter: "npc", idPrefix: "campaign-npc", subtitle: `${translate("NPC")} · ${translate("Campaign scope")}`, title: entityName, target: { ...campaignTarget, hash: makeDomId("campaign", "npc", entity.id || entity.slug) } }));
	entities.locations.forEach((entity) => pushEntity(results, entity, { filter: "locations", idPrefix: "campaign-location", subtitle: `${translate("Location")} · ${translate("Campaign scope")}`, title: locationName, target: { ...campaignTarget, hash: makeDomId("campaign", "location", entity.id || entity.slug) } }));
	sessions.forEach((entry) => appendSessionResults(results, campaign.slug, entry, translate, entityName, locationName));
	return results;
}

function appendSessionResults(
	results: CampaignSearchResult[],
	campaignSlug: string,
	entry: CampaignSearchSession,
	translate: CampaignSearchTranslate,
	entityName: (entity: CampaignSearchRecord) => string,
	locationName: (entity: CampaignSearchRecord) => string,
): void {
	const session = { ...entry, ...asRecord(entry.detail) };
	const fileName = String(entry.fileName || session.fileName || "");
	const data = asRecord(session.data);
	const target = { campaignSlug, sessionFileName: fileName };
	const sessionName = String(session.name || fileName);
	normalizeCampaignSearchRecords(data.notes).forEach((note, index) => pushNote(results, note, { idPrefix: `session-${fileName}-note-${String(note.id || index)}`, subtitle: `${sessionName} · ${translate("Notes")}`, target: { ...target, hash: makeDomId("session", "note", note.id || index) } }));
	normalizeCampaignSearchRecords(data.npcs).forEach((entity) => pushEntity(results, entity, { filter: "npc", idPrefix: `session-${fileName}-npc`, subtitle: `${translate("NPC")} · ${sessionName}`, title: entityName, target: { ...target, hash: makeDomId("session", "npc", entity.id) } }));
	normalizeCampaignSearchRecords(data.locations).forEach((entity) => pushEntity(results, entity, { filter: "locations", idPrefix: `session-${fileName}-location`, subtitle: `${translate("Location")} · ${sessionName}`, title: locationName, target: { ...target, hash: makeDomId("session", "location", entity.id) } }));
	normalizeCampaignSearchRecords(data.scenes).forEach((scene, index) => appendSceneResults(results, scene, index, sessionName, fileName, target, translate));
}

function appendSceneResults(results: CampaignSearchResult[], scene: CampaignSearchRecord, index: number, sessionName: string, fileName: string, target: CampaignSearchTarget, translate: CampaignSearchTranslate): void {
	const identity = getCampaignSearchIdentity(scene.id, index);
	const title = getCampaignSearchSceneTitle(scene, index, translate);
	const sceneTarget = { ...target, hash: makeDomId("session", "scene", identity) };
	pushResult(results, { id: `session-${fileName}-scene-${String(identity)}`, filter: "scenes", title, subtitle: `${translate("Scene")} · ${sessionName}`, text: campaignSearchValueToText(scene), target: sceneTarget });
	appendCampaignSearchSceneNotes(results, scene, { identity, title, fileName, target: sceneTarget, translate });
}

function getCampaignSearchIdentity(value: unknown, fallback: unknown): unknown {
	return value ? value : fallback;
}

function getCampaignSearchSceneTitle(
	scene: CampaignSearchRecord,
	index: number,
	translate: CampaignSearchTranslate,
): string {
	const title = getCampaignSearchIdentity(scene.title, scene.name);
	if (title) return String(title);
	return String(translate("Scene {number}", { number: index + 1 }));
}

interface CampaignSearchSceneNoteOptions {
	identity: unknown;
	title: string;
	fileName: string;
	target: CampaignSearchTarget;
	translate: CampaignSearchTranslate;
}

function appendCampaignSearchSceneNotes(
	results: CampaignSearchResult[],
	scene: CampaignSearchRecord,
	options: CampaignSearchSceneNoteOptions,
): void {
	normalizeCampaignSearchRecords(scene.notes).forEach((note, noteIndex) => pushNote(results, note, {
		idPrefix: `session-${options.fileName}-scene-${String(options.identity)}-note-${String(getCampaignSearchIdentity(note.id, noteIndex))}`,
		subtitle: `${options.title} · ${options.translate("Scene notes")}`,
		target: options.target,
	}));
}

export function filterCampaignSearchResults(
	index: CampaignSearchResult[],
	query: unknown,
	activeFilters: ReadonlySet<CampaignSearchFilter>,
	limit = CAMPAIGN_SEARCH_RESULT_LIMIT,
): CampaignSearchResult[] {
	const normalizedQuery = normalizeCampaignSearchText(query);
	if (!Number.isFinite(limit) || limit < 0) {
		return index
			.filter((item) => activeFilters.has(item.filter))
			.filter(
				(item) =>
					!normalizedQuery || item.searchText.includes(normalizedQuery),
			)
			.slice(0, limit);
	}
	const cappedLimit = Math.trunc(limit);
	if (cappedLimit === 0) return [];
	const results: CampaignSearchResult[] = [];
	for (const item of index) {
		if (!activeFilters.has(item.filter)) continue;
		if (normalizedQuery && !item.searchText.includes(normalizedQuery)) continue;
		results.push(item);
		if (results.length >= cappedLimit) break;
	}
	return results;
}

export function toggleCampaignSearchFilter(active: ReadonlySet<CampaignSearchFilter>, filter: CampaignSearchFilter): Set<CampaignSearchFilter> {
	const next = new Set(active);
	if (next.has(filter)) next.delete(filter);
	else next.add(filter);
	return next.size > 0 ? next : new Set([filter]);
}

export async function loadCampaignSearchIndex(
	options: {
		campaign: CampaignSearchCampaign;
		currentData?: CampaignSearchCampaign | null;
		api: CampaignSearchApi;
		translate: CampaignSearchTranslate;
		requestOptions?: RequestInit;
	},
): Promise<CampaignSearchResult[]> {
	const {
		campaign,
		currentData,
		api,
		translate,
		requestOptions = {},
	} = options;
	const sources = await loadCampaignSearchSources(
		campaign.slug,
		api,
		requestOptions,
	);
	const details = await hydrateCampaignSearchSessions(
		campaign.slug,
		sources.rawSessions,
		api,
		requestOptions,
	);
	return buildCampaignSearchIndex({
		campaign: mergeCampaignSearchCampaign(campaign, currentData),
		entities: {
			characters: getCampaignSearchEntityRecords(currentData, "characters", sources.characters),
			npc: getCampaignSearchEntityRecords(currentData, "npcs", sources.npc),
			locations: getCampaignSearchEntityRecords(currentData, "locations", sources.locations),
		},
		sessions: details,
	}, translate);
}

export interface CampaignSearchLoadEffects {
	setIndex(index: CampaignSearchResult[]): void;
	setError(message: string): void;
	setLoading(loading: boolean): void;
}

export interface CampaignSearchLoadExecutionOptions {
	campaign: CampaignSearchCampaign;
	currentData?: CampaignSearchCampaign | null;
	api: CampaignSearchApi;
	translate: CampaignSearchTranslate;
	unknownErrorMessage: string;
	isCancelled: () => boolean;
	requestOptions?: RequestInit;
	effects: CampaignSearchLoadEffects;
}

function runActiveCampaignSearchEffect(isCancelled: () => boolean, effect: () => void): void {
	if (!isCancelled()) effect();
}

export function getCampaignSearchErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export async function executeCampaignSearchIndexLoad(
	options: CampaignSearchLoadExecutionOptions,
): Promise<void> {
	try {
		const index = await loadCampaignSearchIndex(options);
		runActiveCampaignSearchEffect(options.isCancelled, () => options.effects.setIndex(index));
	} catch (error) {
		const message = getCampaignSearchErrorMessage(error, options.unknownErrorMessage);
		runActiveCampaignSearchEffect(options.isCancelled, () => options.effects.setError(message));
	} finally {
		runActiveCampaignSearchEffect(options.isCancelled, () => options.effects.setLoading(false));
	}
}

interface CampaignSearchSources {
	characters: unknown;
	npc: unknown;
	locations: unknown;
	rawSessions: unknown;
}

async function loadCampaignSearchSources(
	campaignSlug: string,
	api: CampaignSearchApi,
	requestOptions: RequestInit,
): Promise<CampaignSearchSources> {
	const [characters, npc, locations, rawSessions] = await Promise.all([
		api.getEntities(campaignSlug, "characters", requestOptions),
		api.getEntities(campaignSlug, "npc", requestOptions),
		api.getEntities(campaignSlug, "locations", requestOptions),
		api.listSessions(campaignSlug, requestOptions),
	]);
	return { characters, npc, locations, rawSessions };
}

async function hydrateCampaignSearchSession(
	campaignSlug: string,
	session: CampaignSearchRecord,
	api: CampaignSearchApi,
	requestOptions: RequestInit,
): Promise<CampaignSearchSession> {
	const fileName = stringifyTruthyCampaignSearchValue(session.fileName);
	return {
		...session,
		detail: asRecord(
			await api.getSession(campaignSlug, fileName, requestOptions),
		),
	};
}

async function hydrateCampaignSearchSessions(
	campaignSlug: string,
	rawSessions: unknown,
	api: CampaignSearchApi,
	requestOptions: RequestInit,
): Promise<CampaignSearchSession[]> {
	const sessions = normalizeCampaignSearchRecords(rawSessions);
	return mapWithConcurrency(
		sessions,
		CAMPAIGN_SEARCH_SESSION_LOAD_CONCURRENCY,
		(session) =>
			hydrateCampaignSearchSession(
				campaignSlug,
				session,
				api,
				requestOptions,
			),
	);
}

function mergeCampaignSearchCampaign(
	campaign: CampaignSearchCampaign,
	currentData: CampaignSearchCampaign | null | undefined,
): CampaignSearchCampaign {
	return { ...campaign, ...(currentData ? currentData : {}) };
}

function getCampaignSearchEntityRecords(
	currentData: CampaignSearchCampaign | null | undefined,
	key: "characters" | "npcs" | "locations",
	fallback: unknown,
): CampaignSearchRecord[] {
	const currentValue = currentData ? currentData[key] : undefined;
	return normalizeCampaignSearchRecords(currentValue ?? fallback);
}
