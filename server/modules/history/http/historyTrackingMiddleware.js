const { historyService } = require("../runtime");

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function decodePathPart(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function campaignSlugFromPath(pathname) {
	const match = pathname.match(/^\/api\/campaigns\/([^/]+)/);
	if (!match) return null;
	const slug = decodePathPart(match[1]);
	return slug === "reorder" ? null : slug;
}

function campaignSlugFromAiRequest(req) {
	const body = req.body;
	const slug =
		req.query?.campaign ||
		body?.path?.campaign ||
		body?.requestPath?.campaign ||
		body?.campaignSlug ||
		body?.campaign;
	if (!slug || slug === "bestiary") return null;
	return String(slug);
}

function isHistoryPath(pathname) {
	return pathname === "/api/history" || pathname.includes("/history/") || pathname.endsWith("/history");
}

function isApplicationMutation(req, pathname) {
	if (pathname === "/api/campaigns" && req.method === "POST") return true;
	if (pathname === "/api/campaigns/reorder" && req.method === "POST") return true;
	if (/^\/api\/campaigns\/[^/]+$/.test(pathname)) {
		if (req.method === "DELETE") return true;
		if (req.method === "PATCH" && req.body?.name) return true;
	}
	return false;
}

function getOperation(req, pathname) {
	if (isApplicationMutation(req, pathname)) {
		if (pathname === "/api/campaigns") return "campaign.create";
		if (pathname.endsWith("/reorder")) return "campaign.reorder";
		if (req.method === "DELETE") return "campaign.delete";
		return "campaign.rename";
	}
	if (pathname.startsWith("/api/ai/")) {
		if (pathname.endsWith("/undo")) return "ai.undo";
		return "ai.apply";
	}
	if (pathname.endsWith("/monsters")) return "encounter.participant.add";
	if (pathname.includes("/encounters")) return `encounter.${req.method.toLowerCase()}`;
	if (pathname.includes("/sessions/reorder")) return "session.reorder";
	if (pathname.includes("/sessions")) return `session.${req.method.toLowerCase()}`;
	if (pathname.includes("/entities/")) {
		if (req.body?._updateMentionReferences) return "entity.rename-global";
		if (pathname.endsWith("/reorder")) return "entity.reorder";
		if (pathname.endsWith("/move") || pathname.endsWith("/move-scope")) {
			return "entity.move";
		}
		return `entity.${req.method.toLowerCase()}`;
	}
	return `campaign.${req.method.toLowerCase()}`;
}

function getOperationParams(req, pathname) {
	const personName = [req.body?.firstName, req.body?.lastName]
		.filter((value) => value !== null && value !== undefined && String(value).trim())
		.map((value) => String(value).trim())
		.join(" ");
	return {
		method: req.method,
		path: pathname,
		campaignSlug: campaignSlugFromPath(pathname),
		moveImagesToGeneral: Boolean(req.body?.moveImagesToGeneral),
		oldName: req.body?._mentionOldName,
		newName: req.body?.name || personName,
	};
}

function getTrackingTarget(req) {
	if (!MUTATION_METHODS.has(req.method)) return null;
	const pathname = req.path;
	if (isHistoryPath(pathname)) return null;
	if (pathname.includes("/import") || pathname.includes("/archive")) return null;
	if (/^\/api\/campaigns\/[^/]+\/images(?:\/|$)/.test(pathname)) return null;
	if (isApplicationMutation(req, pathname)) return { kind: "application" };
	const pathSlug = campaignSlugFromPath(pathname);
	if (pathSlug) return { kind: "campaign", slug: pathSlug };
	if (pathname.startsWith("/api/ai/")) {
		const aiSlug = campaignSlugFromAiRequest(req);
		if (aiSlug) return { kind: "campaign", slug: aiSlug };
	}
	return null;
}

function finishBeforeResponse(req, res, context, originalEnd) {
	let finishing = false;
	return function trackedEnd(chunk, encoding, callback) {
		if (finishing) return res;
		finishing = true;
		const failed = res.statusCode >= 400;
		const finish = context.kind === "application"
			? historyService.finishApplication(context, failed)
			: historyService.finishCampaign(context, failed);
		void finish.then(
			() => originalEnd(chunk, encoding, callback),
			(error) => {
				console.error("Failed to persist change history", error);
				if (!res.headersSent) {
					res.statusCode = error.status || 500;
					res.removeHeader("Content-Length");
					res.setHeader("Content-Type", "application/json; charset=utf-8");
					originalEnd(
						JSON.stringify({
							error: error.message || "Failed to persist change history.",
							status: res.statusCode,
						}),
						undefined,
						callback,
					);
					return;
				}
				originalEnd(chunk, encoding, callback);
			},
		);
		return res;
	};
}

async function historyTrackingMiddleware(req, res, next) {
	const target = getTrackingTarget(req);
	if (!target) {
		next();
		return;
	}
	try {
		const operation = getOperation(req, req.path);
		const params = getOperationParams(req, req.path);
		const context = target.kind === "application"
			? await historyService.beginApplication(operation, params)
			: await historyService.beginCampaign(target.slug, operation, params);
		const originalEnd = res.end.bind(res);
		res.end = finishBeforeResponse(req, res, context, originalEnd);
		next();
	} catch (error) {
		next(error);
	}
}

module.exports = { historyTrackingMiddleware };
Object.defineProperty(module.exports, "__test", {
	value: { getOperation, getTrackingTarget },
});
