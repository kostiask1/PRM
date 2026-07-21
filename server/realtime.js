const crypto = require("crypto");
const { URL } = require("url");

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const clients = new Map();
let eventSeq = 1;

function createFrame(payload) {
	const data = Buffer.from(payload);
	const length = data.length;

	if (length < 126) {
		return Buffer.concat([Buffer.from([0x81, length]), data]);
	}

	if (length < 65536) {
		const header = Buffer.alloc(4);
		header[0] = 0x81;
		header[1] = 126;
		header.writeUInt16BE(length, 2);
		return Buffer.concat([header, data]);
	}

	const header = Buffer.alloc(10);
	header[0] = 0x81;
	header[1] = 127;
	header.writeBigUInt64BE(BigInt(length), 2);
	return Buffer.concat([header, data]);
}

function send(socket, payload) {
	if (socket.destroyed) return;
	socket.write(createFrame(JSON.stringify(payload)));
}

function closeSocket(socket, clientId) {
	clients.delete(clientId);
	if (!socket.destroyed) socket.destroy();
}

function handleClientFrame(socket, clientId, chunk) {
	if (chunk.length < 2) return;
	const opcode = chunk[0] & 0x0f;
	if (opcode === 0x8) {
		closeSocket(socket, clientId);
	}
}

function setupRealtime(server) {
	server.on("upgrade", (req, socket) => {
		const parsedUrl = new URL(req.url, "http://localhost");
		if (parsedUrl.pathname !== "/api/sync") {
			socket.destroy();
			return;
		}

		const key = req.headers["sec-websocket-key"];
		if (!key) {
			socket.destroy();
			return;
		}

		const clientId =
			parsedUrl.searchParams.get("client") || crypto.randomUUID();
		const accept = crypto
			.createHash("sha1")
			.update(`${key}${WS_GUID}`)
			.digest("base64");

		socket.write(
			[
				"HTTP/1.1 101 Switching Protocols",
				"Upgrade: websocket",
				"Connection: Upgrade",
				`Sec-WebSocket-Accept: ${accept}`,
				"",
				"",
			].join("\r\n"),
		);

		clients.set(clientId, socket);
		socket.on("data", (chunk) => handleClientFrame(socket, clientId, chunk));
		socket.on("close", () => clients.delete(clientId));
		socket.on("error", () => clients.delete(clientId));

		send(socket, {
			type: "sync:connected",
			clientId,
			version: eventSeq,
		});
	});
}

function getPathSegments(originalUrl = "") {
	const parsedUrl = new URL(originalUrl, "http://localhost");
	return parsedUrl.pathname.split("/").filter(Boolean);
}

function getRequestUrl(req) {
	return req.originalUrl || req.url;
}

function createChangeEvent(req, requestUrl) {
	return {
		type: "data:changed",
		version: eventSeq++,
		method: req.method,
		path: requestUrl,
		resource: "unknown",
		campaignSlug: null,
		sessionFileName: null,
		entityType: null,
		entitySlug: null,
	};
}

function describeSettingsChange(event) {
	event.resource = "settings";
}

function describeBestiaryChange(event, segments) {
	event.resource = segments[2] === "custom" ? "custom-bestiary" : "bestiary";
}

function describeImagesChange(event) {
	event.resource = "images";
}

function describeAiChange(event, _segments, requestUrl) {
	event.resource = "ai";
	const parsedUrl = new URL(requestUrl, "http://localhost");
	event.campaignSlug = parsedUrl.searchParams.get("campaign");
}

function describeCampaignSessionChange(event, segments) {
	event.resource = "sessions";
	event.sessionFileName = segments[4] || null;
}

function describeCampaignEntityChange(event, segments) {
	event.resource = "entities";
	event.entityType = segments[4] || null;
	event.entitySlug = segments[5] || null;
}

function describeCampaignNestedChange(event, segments) {
	if (segments[3] === "sessions") {
		describeCampaignSessionChange(event, segments);
		return;
	}
	if (segments[3] === "entities") {
		describeCampaignEntityChange(event, segments);
		return;
	}
	if (segments.includes("images")) {
		event.resource = "images";
		return;
	}
	if (segments.includes("import")) event.resource = "import";
}

function describeCampaignChange(event, segments) {
	event.resource = "campaigns";
	event.campaignSlug = segments[2] || null;
	describeCampaignNestedChange(event, segments);
}

const CHANGE_DESCRIBERS = new Map([
	["settings", describeSettingsChange],
	["bestiary", describeBestiaryChange],
	["images", describeImagesChange],
	["ai", describeAiChange],
	["campaigns", describeCampaignChange],
]);

function describeApiChange(event, segments, requestUrl) {
	CHANGE_DESCRIBERS.get(segments[1])?.(event, segments, requestUrl);
}

function describeChange(req) {
	const requestUrl = getRequestUrl(req);
	const segments = getPathSegments(requestUrl);
	const event = createChangeEvent(req, requestUrl);

	if (segments[0] !== "api") return event;
	describeApiChange(event, segments, requestUrl);
	return event;
}

function notifyChange(req) {
	const sourceClientId = req.headers["x-sync-client-id"];
	const payload = describeChange(req);

	for (const [clientId, socket] of clients.entries()) {
		if (clientId === sourceClientId) continue;
		send(socket, payload);
	}
}

function shouldNotifyRealtimeChange(req, res) {
	if (!req.originalUrl?.startsWith("/api/")) return false;
	if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
	return !(res.statusCode >= 400);
}

function realtimeMiddleware(req, res, next) {
	res.on("finish", () => {
		if (shouldNotifyRealtimeChange(req, res)) notifyChange(req);
	});
	next();
}

module.exports = {
	realtimeMiddleware,
	setupRealtime,
};
