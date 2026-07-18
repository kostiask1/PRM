import { objectMatchesSearch } from "../../../shared/lib/index.js";

export const REFERENCE_TAB_IDS = [
	"conditions",
	"diseases",
	"senses",
	"skills",
	"variantrules",
	"spells",
	"bestiary",
] as const;

export type ReferenceTabId = (typeof REFERENCE_TAB_IDS)[number];

export interface ReferenceItem extends Record<string, unknown> {
	name?: string;
	source?: string;
	kind?: string;
}

export interface ReferenceTabPolicy {
	id: ReferenceTabId;
	label: string;
	emptyLabel: string;
	searchFields: string[];
}

export interface ReferenceSelection<TItem extends ReferenceItem = ReferenceItem> {
	tabId: ReferenceTabId;
	item: TItem;
	name: string;
	tag: string;
}

export const REFERENCE_TAB_POLICIES: ReferenceTabPolicy[] = [
	{ id: "conditions", label: "Conditions", emptyLabel: "No conditions or statuses found.", searchFields: ["name"] },
	{ id: "diseases", label: "Diseases", emptyLabel: "No diseases found.", searchFields: ["name", "type"] },
	{ id: "senses", label: "Senses", emptyLabel: "No senses found.", searchFields: ["name"] },
	{ id: "skills", label: "Skills", emptyLabel: "No skills found.", searchFields: ["name", "ability"] },
	{ id: "variantrules", label: "Variant Rules", emptyLabel: "No variant rules found.", searchFields: ["name", "ruleType"] },
	{ id: "spells", label: "Spells", emptyLabel: "No spells found.", searchFields: ["name", "school", "source", "level", "level_int"] },
	{ id: "bestiary", label: "Bestiary", emptyLabel: "No creatures found.", searchFields: ["name", "source", "cr"] },
];

const TAB_ID_SET = new Set<ReferenceTabId>(REFERENCE_TAB_IDS);

export function isReferenceTabId(value: unknown): value is ReferenceTabId {
	return typeof value === "string" && TAB_ID_SET.has(value as ReferenceTabId);
}

export function getInitialTabId(value: unknown): ReferenceTabId {
	return isReferenceTabId(value) ? value : "conditions";
}

export function normalizeReferenceList(value: unknown): ReferenceItem[] {
	return Array.isArray(value) ? (value as ReferenceItem[]) : [];
}

export function combineBestiaryLists(official: unknown, custom: unknown): ReferenceItem[] {
	const readList = (value: unknown): ReferenceItem[] => {
		if (Array.isArray(value)) return value as ReferenceItem[];
		if (!value || typeof value !== "object") return [];
		const record = value as Record<string, unknown>;
		return normalizeReferenceList(record.monster ?? record.monsters ?? record.results);
	};
	return [...readList(official), ...readList(custom)];
}

export function getReferenceItemKey(tabId: ReferenceTabId, item: ReferenceItem): string {
	return `${tabId}:${String(item.source || "")}:${String(item.name || "")}`;
}

export function getSpellReferenceName(item: ReferenceItem = {}): string {
	return getQualifiedReferenceName(item);
}

export function getCreatureReferenceName(item: ReferenceItem = {}): string {
	return getQualifiedReferenceName(item);
}

function getQualifiedReferenceName(item: ReferenceItem): string {
	const name = String(item.name || "").trim();
	if (!name) return "";
	const source = String(item.source || "").trim();
	return source ? `${name}|${source}` : name;
}

export function getReferenceInlineTag(tabId: ReferenceTabId, item: ReferenceItem = {}): string {
	const name = String(item.name || "").trim();
	if (!name) return "";
	const simpleTags: Partial<Record<ReferenceTabId, string>> = {
		diseases: "disease",
		senses: "sense",
		skills: "skill",
		variantrules: "variantrule",
	};
	if (tabId === "conditions") return `{@${item.kind === "status" ? "status" : "condition"} ${name}}`;
	if (tabId === "spells") return `{@spell ${getSpellReferenceName(item)}}`;
	if (tabId === "bestiary") return `{@creature ${getCreatureReferenceName(item)}}`;
	const tag = simpleTags[tabId];
	return tag ? `{@${tag} ${name}}` : name;
}

function parseCreatureReference(value: unknown): { name: string; source: string } {
	const [name = "", source = ""] = String(value || "").split("|");
	return { name: name.trim().toLowerCase(), source: source.trim().toUpperCase() };
}

export function getCreatureReferenceMatchRank(item: ReferenceItem, selectedName: unknown): number {
	const selected = parseCreatureReference(selectedName);
	const candidate = parseCreatureReference(getCreatureReferenceName(item));
	if (!selected.name || candidate.name !== selected.name) return 0;
	if (!selected.source) return 2;
	return candidate.source === selected.source ? 3 : 1;
}

export function getReferenceSelectionName(tabId: ReferenceTabId, item: ReferenceItem = {}): string {
	if (tabId === "spells") return getSpellReferenceName(item);
	if (tabId === "bestiary") return getCreatureReferenceName(item);
	return String(item.name || "");
}

export function itemMatchesSelectedName(tabId: ReferenceTabId, item: ReferenceItem, selectedName: unknown): boolean {
	const selected = String(selectedName || "").trim();
	if (!selected) return false;
	if (tabId === "bestiary") return getCreatureReferenceMatchRank(item, selected) > 0;
	return getReferenceSelectionName(tabId, item) === selected || String(item.name || "") === selected;
}

export function findSelectedReferenceItem(tabId: ReferenceTabId, items: ReferenceItem[], selectedName: unknown): ReferenceItem | null {
	if (tabId !== "bestiary") return items.find((item) => itemMatchesSelectedName(tabId, item, selectedName)) ?? null;
	let match: ReferenceItem | null = null;
	let rank = 0;
	for (const item of items) {
		const candidateRank = getCreatureReferenceMatchRank(item, selectedName);
		if (candidateRank > rank) {
			match = item;
			rank = candidateRank;
		}
		if (rank === 3) break;
	}
	return match;
}

export function itemMatchesQuery(
	policy: ReferenceTabPolicy,
	item: ReferenceItem,
	normalizedQuery: string,
	isDetailedSearch: boolean,
	metaValue: unknown = "",
): boolean {
	if (!normalizedQuery) return true;
	const values = [...policy.searchFields.map((field) => item[field]), metaValue].filter(Boolean);
	return (isDetailedSearch && objectMatchesSearch(item, normalizedQuery)) ||
		values.some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

export function createReferenceSelection<TItem extends ReferenceItem>(
	tabId: ReferenceTabId,
	item: TItem,
): ReferenceSelection<TItem> | null {
	const name = String(item.name || "");
	if (!name) return null;
	return { tabId, item, name, tag: getReferenceInlineTag(tabId, item) };
}
