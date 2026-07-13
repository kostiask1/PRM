export type CampaignSlug = string;
export type SessionFileName = string;
export type EncounterId = string | number;

export interface ParsedNavigationRoute {
	campaign: CampaignSlug | null;
	session: SessionFileName | null;
	encounter: string | null;
}

export interface NavigationModifierEvent {
	ctrlKey?: boolean;
	metaKey?: boolean;
}

// Get navigation state from URL.
export const parseUrl = (pathname: string | null = null): ParsedNavigationRoute => {
	const path =
		pathname ??
		(typeof window !== "undefined" ? window.location.pathname : "/");
	const parts = path.split("/").filter(Boolean);
	let campaign: CampaignSlug | null = null;
	let session: SessionFileName | null = null;
	let encounter: string | null = null;

	if (parts[0] === "campaign" && parts[1]) {
		campaign = decodeURIComponent(parts[1]);
		if (parts[2] === "session" && parts[3]) {
			session = decodeURIComponent(parts[3]);
			if (parts[4] === "encounter" && parts[5]) {
				encounter = decodeURIComponent(parts[5]);
			}
		}
	}
	return { campaign, session, encounter };
};

export function buildNavigationUrl(
	slug: CampaignSlug | null | undefined,
	fileName: SessionFileName | null = null,
	encounterId: EncounterId | null = null,
): string {
	if (!slug) return "/";
	let url = `/campaign/${encodeURIComponent(slug)}`;
	if (fileName) {
		url += `/session/${encodeURIComponent(fileName)}`;
		if (encounterId) {
			url += `/encounter/${encodeURIComponent(encounterId)}`;
		}
	}
	return url;
}

export function shouldOpenInNewTabFromEvent(
	event: NavigationModifierEvent | null | undefined,
): boolean {
	return Boolean(event?.ctrlKey || event?.metaKey);
}
