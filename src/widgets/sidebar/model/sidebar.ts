import type { CampaignRecord } from "../../../entities/campaign/index.js";

export type SidebarCampaignGroup = "active" | "completed";

export interface SidebarCampaign extends CampaignRecord {
	completed?: boolean;
	sessionCount?: number;
}

export interface SidebarCampaignGroups {
	active: SidebarCampaign[];
	completed: SidebarCampaign[];
}

export type CampaignOrderMap = Record<string, number>;

export function groupSidebarCampaigns(
	campaigns: readonly SidebarCampaign[],
): SidebarCampaignGroups {
	const active: SidebarCampaign[] = [];
	const completed: SidebarCampaign[] = [];

	for (const campaign of campaigns) {
		if (campaign.completed) completed.push(campaign);
		else active.push(campaign);
	}

	return { active, completed };
}

export function mergeSidebarCampaignGroup(
	groups: SidebarCampaignGroups,
	group: SidebarCampaignGroup,
	items: readonly SidebarCampaign[],
): SidebarCampaign[] {
	return group === "completed"
		? [...groups.active, ...items]
		: [...items, ...groups.completed];
}

export function buildSidebarCampaignOrder(
	campaigns: readonly SidebarCampaign[],
): CampaignOrderMap {
	return Object.fromEntries(
		campaigns.map((campaign, index) => [campaign.slug, index]),
	);
}

export interface CampaignSelectionContext {
	campaignSlug: string;
	activeCampaignSlug?: string | null;
	activeSessionFileName?: string | null;
	activeEncounterId?: string | number | null;
}

export function getSidebarCampaignSelection({
	campaignSlug,
	activeCampaignSlug,
	activeSessionFileName,
	activeEncounterId,
}: CampaignSelectionContext): string {
	const isCampaignRootActive =
		activeCampaignSlug === campaignSlug &&
		!activeSessionFileName &&
		!activeEncounterId;
	return isCampaignRootActive ? "" : campaignSlug;
}

export function getSidebarClassName(
	isExpanded: boolean,
	isMobileOpen: boolean,
): string {
	return `Sidebar App__sidebar${isExpanded ? " Sidebar__hovered" : ""}${isMobileOpen ? " Sidebar__mobile_open" : ""}`;
}

export function getSidebarCampaignMonogram(name?: string | null): string {
	const words = String(name || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (words.length === 0) return "?";
	if (words.length >= 2) {
		return `${Array.from(words[0])[0] || ""}${Array.from(words[1])[0] || ""}`.toLocaleUpperCase();
	}
	return Array.from(words[0]).slice(0, 2).join("").toLocaleUpperCase();
}

export function isSidebarToggleKey(key: string): boolean {
	return key === "Enter" || key === " ";
}

export function getSidebarErrorMessage(
	error: unknown,
	fallback: string,
): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export const SIDEBAR_SHORTCUT_LABELS = Object.freeze({
	bestiary: "CTRL+B",
	spells: "CTRL+S",
	rulesReference: "CTRL+/",
	gallery: "CTRL+G",
	diceCalculator: "CTRL+D",
	playerQuestions: "CTRL+P",
	settings: "CTRL+,",
	newCampaign: "ALT+N",
	exportData: "CTRL+SHIFT+E",
	importData: "CTRL+SHIFT+I",
	undo: "CTRL+Z",
	redo: "CTRL+Y",
	globalSearch: "CTRL+K",
	aiAssistant: "CTRL+J",
});

export type SidebarShortcutAction =
	| "bestiary"
	| "spells"
	| "rulesReference"
	| "gallery"
	| "playerQuestions"
	| "settings"
	| "newCampaign"
	| "exportData"
	| "importData"
	| "globalSearch"
	| "aiAssistant"
	| null;

export interface SidebarShortcutKeyboardInput {
	key?: string;
	code?: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
	repeat?: boolean;
	isEditableTarget?: boolean;
}

export function isSidebarEditableTarget(target: unknown): boolean {
	if (!target || typeof target !== "object") return false;
	const candidate = target as {
		tagName?: unknown;
		isContentEditable?: unknown;
		closest?: unknown;
	};
	const tagName = String(candidate.tagName || "").toUpperCase();
	if (
		tagName === "INPUT" ||
		tagName === "TEXTAREA" ||
		tagName === "SELECT" ||
		candidate.isContentEditable === true
	) {
		return true;
	}
	return (
		typeof candidate.closest === "function" &&
		Boolean(
			(candidate as { closest: (selector: string) => unknown }).closest(
				"[contenteditable='true']",
			),
		)
	);
}

export function getSidebarShortcutAction(
	input: SidebarShortcutKeyboardInput,
): SidebarShortcutAction {
	if (input.repeat || input.isEditableTarget) return null;

	const key = String(input.key || "").toLowerCase();
	const code = String(input.code || "");
	const hasPrimaryMod = Boolean(input.ctrlKey || input.metaKey);

	if (!hasPrimaryMod && Boolean(input.altKey) && !input.shiftKey) {
		if (code === "KeyN" || key === "n" || key === "т") return "newCampaign";
		return null;
	}

	if (hasPrimaryMod && !input.altKey && Boolean(input.shiftKey)) {
		if (code === "KeyE" || key === "e" || key === "у") return "exportData";
		if (code === "KeyI" || key === "i" || key === "ш") return "importData";
		return null;
	}

	if (hasPrimaryMod && !input.altKey && !input.shiftKey) {
		if (code === "KeyB" || key === "b" || key === "и") return "bestiary";
		if (code === "KeyS" || key === "s" || key === "і" || key === "ї" || key === "ы") {
			return "spells";
		}
		if (code === "Slash" || key === "/" || (!code && key === ".")) {
			return "rulesReference";
		}
		if (code === "KeyG" || key === "g" || key === "п") return "gallery";
		if (code === "KeyP" || key === "p" || key === "з") return "playerQuestions";
		if (code === "Comma" || key === "," || (code !== "KeyB" && key === "б")) {
			return "settings";
		}
		if (code === "KeyK" || key === "k" || key === "л") return "globalSearch";
		if (code === "KeyJ" || key === "j" || key === "о") return "aiAssistant";
	}

	return null;
}
