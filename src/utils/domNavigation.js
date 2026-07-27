export function makeDomId(...parts) {
	return parts
		.map((part) => String(part ?? "").trim())
		.filter(Boolean)
		.map((part) => part.replace(/[^a-zA-Z0-9_-]+/g, "-"))
		.join("-");
}

export function scrollToHashTarget(hash = window.location.hash) {
	const targetId = decodeURIComponent(String(hash || "").replace(/^#/, ""));
	if (!targetId) return false;
	const target = document.getElementById(targetId);
	if (!target) return false;
	target.scrollIntoView({ behavior: "smooth", block: "center" });
	target.classList.add("is_searchTarget");
	window.setTimeout(() => {
		target.classList.remove("is_searchTarget");
	}, 1800);
	return true;
}
