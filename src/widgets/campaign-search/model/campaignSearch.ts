import { makeDomId } from "../../../shared/lib/index.js";

export const CAMPAIGN_SEARCH_FILTERS = ["notes", "scenes", "npc", "locations"] as const;
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
	getEntities(slug: string, type: string): Promise<unknown>;
	listSessions(slug: string): Promise<unknown>;
	getSession(slug: string, fileName: string): Promise<unknown>;
}

function asRecord(value: unknown): CampaignSearchRecord {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as CampaignSearchRecord)
		: {};
}

export function normalizeCampaignSearchRecords(value: unknown): CampaignSearchRecord[] {
	return Array.isArray(value) ? value.map(asRecord) : [];
}

export function campaignSearchValueToText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string" || typeof value === "number") return String(value);
	if (Array.isArray(value)) return value.map(campaignSearchValueToText).join("\n");
	if (typeof value !== "object") return "";
	return Object.entries(value)
		.filter(([key]) => !key.startsWith("_") && key !== "imageUrl")
		.map(([, item]) => campaignSearchValueToText(item))
		.join("\n");
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

export function buildCampaignSearchSnippet(text: unknown, query: unknown): string {
	const source = String(text || "").replace(/\s+/g, " ").trim();
	if (!source) return "";
	const normalizedQuery = normalizeCampaignSearchText(query);
	const index = normalizedQuery ? normalizeCampaignSearchText(source).indexOf(normalizedQuery) : -1;
	const start = index >= 0 ? Math.max(0, index - 70) : 0;
	const snippet = source.slice(start, start + 180);
	return `${start > 0 ? "..." : ""}${snippet}${start + 180 < source.length ? "..." : ""}`;
}

function getEntityName(entity: CampaignSearchRecord, fallback: string, untitled: string): string {
	const fullName = `${String(entity.firstName || "")} ${String(entity.lastName || "")}`.trim();
	return fullName || String(entity.name || entity.title || fallback || untitled);
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
	const title = String(scene.title || scene.name || translate("Scene {number}", { number: index + 1 }));
	const sceneTarget = { ...target, hash: makeDomId("session", "scene", scene.id || index) };
	pushResult(results, { id: `session-${fileName}-scene-${String(scene.id || index)}`, filter: "scenes", title, subtitle: `${translate("Scene")} · ${sessionName}`, text: campaignSearchValueToText(scene), target: sceneTarget });
	normalizeCampaignSearchRecords(scene.notes).forEach((note, noteIndex) => pushNote(results, note, { idPrefix: `session-${fileName}-scene-${String(scene.id || index)}-note-${String(note.id || noteIndex)}`, subtitle: `${title} · ${translate("Scene notes")}`, target: sceneTarget }));
}

export function filterCampaignSearchResults(index: CampaignSearchResult[], query: unknown, activeFilters: ReadonlySet<CampaignSearchFilter>, limit = 80): CampaignSearchResult[] {
	const normalizedQuery = normalizeCampaignSearchText(query);
	return index.filter((item) => activeFilters.has(item.filter)).filter((item) => !normalizedQuery || item.searchText.includes(normalizedQuery)).slice(0, limit);
}

export function toggleCampaignSearchFilter(active: ReadonlySet<CampaignSearchFilter>, filter: CampaignSearchFilter): Set<CampaignSearchFilter> {
	const next = new Set(active);
	if (next.has(filter)) next.delete(filter);
	else next.add(filter);
	return next.size > 0 ? next : new Set([filter]);
}

export async function loadCampaignSearchIndex(
	options: { campaign: CampaignSearchCampaign; currentData?: CampaignSearchCampaign | null; api: CampaignSearchApi; translate: CampaignSearchTranslate },
): Promise<CampaignSearchResult[]> {
	const { campaign, currentData, api, translate } = options;
	const [characters, npc, locations, rawSessions] = await Promise.all([
		api.getEntities(campaign.slug, "characters"), api.getEntities(campaign.slug, "npc"), api.getEntities(campaign.slug, "locations"), api.listSessions(campaign.slug),
	]);
	const sessions = normalizeCampaignSearchRecords(rawSessions);
	const details = await Promise.all(sessions.map(async (session) => ({
		...session,
		detail: asRecord(await api.getSession(campaign.slug, String(session.fileName || ""))),
	})));
	return buildCampaignSearchIndex({
		campaign: { ...campaign, ...(currentData || {}) },
		entities: {
			characters: normalizeCampaignSearchRecords(currentData?.characters ?? characters),
			npc: normalizeCampaignSearchRecords(currentData?.npcs ?? npc),
			locations: normalizeCampaignSearchRecords(currentData?.locations ?? locations),
		},
		sessions: details,
	}, translate);
}
