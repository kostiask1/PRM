// Функція для отримання стану з URL
export const parseUrl = () => {
	const path = window.location.pathname;
	const parts = path.split("/").filter(Boolean);
	let campaign = null;
	let session = null;
	let encounter = null;

	if (parts[0] === "campaign" && parts[1]) {
		campaign = decodeURIComponent(parts[1]);
		if (parts[2] === "session" && parts[3]) {
			session = decodeURIComponent(parts[3]);
			if (parts[4] === "encounter" && parts[5]) {
				encounter = decodeURIComponent(parts[5]);
			}
		}
	} else if (parts[0] === "bestiary") {
		campaign = "bestiary";
	} else if (parts[0] === "spells") {
		campaign = "spells";
	}
	return { campaign, session, encounter };
};

export function buildNavigationUrl(slug, fileName = null, encounterId = null) {
	if (!slug) return "/";
	if (slug === "bestiary") return "/bestiary";
	if (slug === "spells") return "/spells";
	let url = `/campaign/${encodeURIComponent(slug)}`;
	if (fileName) {
		url += `/session/${encodeURIComponent(fileName)}`;
		if (encounterId) {
			url += `/encounter/${encodeURIComponent(encounterId)}`;
		}
	}
	return url;
}

export function shouldOpenInNewTabFromEvent(event) {
	return Boolean(event?.ctrlKey || event?.metaKey);
}
