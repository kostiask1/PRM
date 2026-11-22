const {
	parseChatCommands,
	extractMentionedEntityNames,
	normalizeChatMentionsSyntax,
	evaluateDiceExpressions,
} = require("./chatCommandParser");
const {
	estimateTokensFromText,
	buildChatWorkspaceContext,
	buildChatSystemInstruction,
	buildChatTurnPrompt,
	compactChatHistoryIfNeeded,
} = require("./chatPromptBuilder");
const {
	prepareChatActionCards,
	applyChatActionCard,
	undoChatActionCard,
} = require("./chatActionExecutor");

function createHttpError(message, status, code = null) {
	const error = new Error(message);
	error.status = status;
	if (code) error.code = code;
	return error;
}

function asText(value) {
	return String(value ?? "").trim();
}

function resolveRequestedModelName(availableModels, requestedModel) {
	const models = Array.isArray(availableModels?.models) ? availableModels.models : [];
	const cleaned = asText(requestedModel).replace(/^models\//, "");
	if (cleaned && models.some((m) => m.name === cleaned)) {
		return cleaned;
	}
	if (availableModels?.defaultModel) {
		return availableModels.defaultModel;
	}
	if (models[0]?.name) {
		return models[0].name;
	}
	if (cleaned) {
		return cleaned;
	}
	throw createHttpError(
		availableModels?.error || "No Gemini models are available. Check your API key and try again.",
		400,
		"NO_MODELS_AVAILABLE",
	);
}

function resolveModelMaxTokens(availableModels, modelName) {
	const models = Array.isArray(availableModels?.models) ? availableModels.models : [];
	const match = models.find((m) => m.name === modelName);
	const limit = Number(match?.inputTokenLimit);
	return Number.isFinite(limit) && limit > 0 ? limit : 1000000;
}

function parseAssistantJsonOutput({
	rawText,
	extractFirstJsonObject,
	normalizeEscapedNewLines,
}) {
	try {
		const jsonText = extractFirstJsonObject(rawText);
		const parsed = normalizeEscapedNewLines(JSON.parse(jsonText));
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			const replyCandidate =
				parsed.reply ?? parsed.message ?? parsed.response ?? parsed.text;
			const reply = typeof replyCandidate === "string"
				? replyCandidate
				: String(rawText || "");
			return {
				chatTitle: typeof parsed.chatTitle === "string" ? parsed.chatTitle : "",
				reply,
				actions: Array.isArray(parsed.actions) ? parsed.actions : [],
			};
		}
	} catch {
		// Fall through to plain markdown reply wrapper
	}
	return {
		chatTitle: "",
		reply: String(rawText || "").replace(/\\n/g, "\n").trim(),
		actions: [],
	};
}

const STREAMING_ESCAPE_MAP = Object.freeze({
	n: "\n",
	r: "\r",
	t: "\t",
	'"': '"',
	"\\": "\\",
	"/": "/",
	b: "\b",
	f: "\f",
});

function extractStreamingReplyPreview(rawText) {
	const raw = String(rawText || "");
	const trimmedStart = raw.trimStart();
	if (!trimmedStart) {
		return { text: "", replyComplete: false };
	}
	if (!trimmedStart.startsWith("{") && !trimmedStart.startsWith("```")) {
		return {
			text: raw.replace(/\\n/g, "\n"),
			replyComplete: false,
		};
	}

	const match = /(?:^|[{,\s])"reply"\s*:\s*"/.exec(raw);
	if (!match) {
		return { text: "", replyComplete: false };
	}

	let out = "";
	let replyComplete = false;
	for (let i = match.index + match[0].length; i < raw.length; i += 1) {
		const ch = raw[i];
		if (ch === '"') {
			replyComplete = true;
			break;
		}
		if (ch !== "\\") {
			out += ch;
			continue;
		}
		if (i + 1 >= raw.length) {
			break;
		}
		const esc = raw[i + 1];
		if (Object.prototype.hasOwnProperty.call(STREAMING_ESCAPE_MAP, esc)) {
			out += STREAMING_ESCAPE_MAP[esc];
			i += 1;
			continue;
		}
		if (esc === "u") {
			if (i + 5 >= raw.length) {
				break;
			}
			const hex = raw.slice(i + 2, i + 6);
			if (/^[0-9a-fA-F]{4}$/.test(hex)) {
				out += String.fromCharCode(parseInt(hex, 16));
				i += 5;
				continue;
			}
		}
		out += esc;
		i += 1;
	}

	return { text: out, replyComplete };
}

function deriveFallbackTitle(text) {
	const clean = String(text || "").replace(/\s+/g, " ").trim();
	if (!clean) return "Новий діалог";
	return clean.length > 42 ? `${clean.slice(0, 42).trimEnd()}...` : clean;
}

function collectActionCreatedEntityNames(rawActions) {
	const names = [];
	for (const action of Array.isArray(rawActions) ? rawActions : []) {
		for (const op of Array.isArray(action?.operations) ? action.operations : []) {
			const data = op?.data || op?.patch;
			if (!data || typeof data !== "object") continue;
			const combined = `${data.firstName || ""} ${data.lastName || ""}`.trim();
			const name = asText(data.name || combined || data.title);
			if (name) names.push(name);
		}
	}
	return names;
}

function findActionCardLocation(messages, actionId) {
	const targetId = asText(actionId);
	for (let mIdx = 0; mIdx < messages.length; mIdx += 1) {
		const msg = messages[mIdx];
		const cards = Array.isArray(msg?.actionCards) ? msg.actionCards : [];
		for (let cIdx = 0; cIdx < cards.length; cIdx += 1) {
			if (String(cards[cIdx]?.id ?? "") === targetId) {
				return { messageIndex: mIdx, cardIndex: cIdx, card: cards[cIdx] };
			}
		}
	}
	return null;
}

function replaceActionCardInMessages(messages, location, nextCard) {
	return messages.map((msg, mIdx) => {
		if (mIdx !== location.messageIndex) return msg;
		const nextCards = (msg.actionCards || []).map((c, cIdx) =>
			cIdx === location.cardIndex ? nextCard : c,
		);
		return { ...msg, actionCards: nextCards };
	});
}

function buildUserMessageAttachments(attachedImages, attachedFiles) {
	const items = [];
	for (const img of Array.isArray(attachedImages) ? attachedImages.slice(0, 4) : []) {
		if (!img || typeof img !== "object") continue;
		items.push({
			name: img.name || "image",
			mimeType: img.mimeType || img.type,
			sizeBytes: img.sizeBytes || img.size,
			url: img.url,
		});
	}
	for (const file of Array.isArray(attachedFiles) ? attachedFiles.slice(0, 4) : []) {
		if (!file || typeof file !== "object") continue;
		items.push({
			name: file.name || "file",
			mimeType: file.mimeType || file.type,
			sizeBytes: file.sizeBytes || file.size,
		});
	}
	return items;
}

function createAiChatCommands({
	chatRepository,
	storage,
	aiService,
	geminiGateway,
	historyWriter,
	applyAiOperations,
	restoreAiResponseSnapshot,
	buildCustomMonsterChangeResources,
	filterSessionDataForAiContext,
	fillCurrentTargetIds,
	applyMentionsToGeneratedContent,
	processGeneratedTextMentions,
	validateAiGeneratedContent,
	extractFirstJsonObject,
	normalizeEscapedNewLines,
	buildImageParts,
	buildFileParts,
	isApiKeyConfigured = () => Boolean(process.env.GEMINI_API_KEY),
}) {
	async function listChats({ campaignSlug }) {
		return chatRepository.list(campaignSlug);
	}

	async function getChat({ campaignSlug, chatId }) {
		const chat = await chatRepository.get(campaignSlug, chatId);
		if (!chat) throw createHttpError("AI chat not found.", 404);
		return chat;
	}

	async function createChat({ campaignSlug, payload = {} }) {
		return chatRepository.create(campaignSlug, payload);
	}

	async function updateChat({ campaignSlug, chatId, payload = {} }) {
		const allowedPatch = {};
		for (const key of ["title", "model", "autoApply", "contextSettings", "anchor"]) {
			if (Object.prototype.hasOwnProperty.call(payload, key)) {
				allowedPatch[key] = payload[key];
			}
		}
		if (Object.prototype.hasOwnProperty.call(allowedPatch, "title")) {
			allowedPatch.isAutoTitled = true;
		}
		return chatRepository.update(campaignSlug, chatId, allowedPatch);
	}

	async function deleteChat({ campaignSlug, chatId }) {
		return chatRepository.delete(campaignSlug, chatId);
	}

	async function sendMessage({
		campaignSlug,
		chatId,
		payload = {},
		onStreamEvent = null,
		signal = null,
	}) {
		if (!isApiKeyConfigured()) {
			throw createHttpError("Gemini API key is required.", 400, "API_KEY_MISSING");
		}

		const rawContent = String(payload.content ?? "");
		const attachedImages = Array.isArray(payload.attachedImages) ? payload.attachedImages.slice(0, 4) : [];
		const attachedFiles = Array.isArray(payload.attachedFiles) ? payload.attachedFiles.slice(0, 4) : [];
		if (!rawContent.trim() && attachedImages.length === 0 && attachedFiles.length === 0) {
			throw createHttpError("Message content or attachment is required.", 400);
		}

		let chat = chatId && chatId !== "new"
			? await chatRepository.get(campaignSlug, chatId)
			: null;
		if (chatId && chatId !== "new" && !chat) {
			throw createHttpError("AI chat not found.", 404);
		}
		if (!chat) {
			chat = await chatRepository.create(campaignSlug, {
				model: payload.model,
				autoApply: payload.autoApply,
				contextSettings: payload.contextSettings,
				anchor: payload.anchor,
			});
		}

		const effectiveSettings = payload.contextSettings
			? { ...chat.contextSettings, ...payload.contextSettings }
			: chat.contextSettings;
		const effectiveAutoApply =
			typeof payload.autoApply === "boolean" ? payload.autoApply : chat.autoApply;
		const effectiveAnchor = payload.anchor !== undefined ? payload.anchor : chat.anchor;

		const settings = await storage.readSettings().catch(() => ({}));
		const responseLanguage = asText(payload.language || settings?.language || "uk");
		const availableModels = await aiService.listAvailableModels();
		const selectedModel = resolveRequestedModelName(
			availableModels,
			payload.model || chat.model,
		);
		const maxTokens = resolveModelMaxTokens(availableModels, selectedModel);

		const { commands, cleanedText } = parseChatCommands(rawContent);
		const mentionedNames = extractMentionedEntityNames(rawContent);
		const diceRolls = commands.includes("dice") ? evaluateDiceExpressions(rawContent) : [];

		const workspaceContext = payload.workspaceContext && typeof payload.workspaceContext === "object"
			? payload.workspaceContext
			: {};
		const resolvedSessionFileName =
			asText(workspaceContext.sessionFileName) ||
			(effectiveAnchor?.pinned ? asText(effectiveAnchor.sessionFileName) : "");
		const resolvedEncounterId =
			workspaceContext.encounterId ?? (effectiveAnchor?.pinned ? effectiveAnchor.encounterId : null);
		const resolvedSceneId =
			workspaceContext.sceneId ?? (effectiveAnchor?.pinned ? effectiveAnchor.sceneId : null);

		const {
			campaign,
			contextPayload,
			mentionCandidateNames,
			simplifiedNotes,
		} = await buildChatWorkspaceContext(
			{ storage, filterSessionDataForAiContext },
			{
				campaignSlug,
				workspaceContext: {
					...workspaceContext,
					sessionFileName: resolvedSessionFileName,
					encounterId: resolvedEncounterId,
					sceneId: resolvedSceneId,
				},
				contextSettings: effectiveSettings,
				mentionedNames,
				commands,
			},
		);

		const needsTitle =
			!chat.isAutoTitled &&
			chat.messages.filter((msg) => msg.role === "user").length === 0;

		const compaction = await compactChatHistoryIfNeeded(
			{ geminiGateway },
			{ chat, modelName: selectedModel, responseLanguage },
		);

		const globalBasePrompt = asText(settings?.aiBasePrompt);
		const campaignBasePrompt = asText(settings?.campaignAiBasePrompts?.[campaignSlug]);
		const systemInstruction = buildChatSystemInstruction({
			responseLanguage,
			responseTone: effectiveSettings.responseTone,
			commands,
			workspaceViewType: contextPayload.workspace.viewType,
			needsTitle,
			globalBasePrompt,
			campaignBasePrompt,
			simplifiedNotes,
		});

		const normalizedUserText = normalizeChatMentionsSyntax(rawContent);
		const attachmentList = buildUserMessageAttachments(attachedImages, attachedFiles);
		const { userPrompt, tokenEstimate } = buildChatTurnPrompt({
			summary: compaction.summary,
			recentMessages: chat.messages,
			contextPayload,
			userMessage: rawContent,
			diceRolls,
			needsTitle,
			attachments: attachmentList,
		});

		const imageParts = attachedImages.length > 0 ? await buildImageParts(attachedImages) : [];
		const fileParts = attachedFiles.length > 0 ? buildFileParts(attachedFiles) : [];
		const attachmentParts = [...imageParts, ...fileParts];

		onStreamEvent?.({ type: "status", phase: "thinking" });

		let rawAiText = "";
		if (
			typeof onStreamEvent === "function" &&
			typeof geminiGateway.generateTextStream === "function"
		) {
			let lastEmittedText = "";
			let emittedPreparing = false;
			rawAiText = await geminiGateway.generateTextStream({
				modelName: selectedModel,
				systemInstruction,
				useJsonResponse: true,
				userPrompt,
				attachmentParts,
				signal,
				onChunk: (_delta, fullText) => {
					const preview = extractStreamingReplyPreview(fullText);
					if (preview.text !== lastEmittedText) {
						lastEmittedText = preview.text;
						onStreamEvent({
							type: "delta",
							text: preview.text,
							replyComplete: preview.replyComplete,
						});
					}
					if (preview.replyComplete && !emittedPreparing) {
						emittedPreparing = true;
						onStreamEvent({ type: "status", phase: "preparing_actions" });
					}
				},
			});
		} else {
			rawAiText = await geminiGateway.generateText({
				modelName: selectedModel,
				systemInstruction,
				useJsonResponse: true,
				userPrompt,
				attachmentParts,
			});
		}

		const parsed = parseAssistantJsonOutput({
			rawText: rawAiText,
			extractFirstJsonObject,
			normalizeEscapedNewLines,
		});

		if (parsed.actions.length > 0) {
			onStreamEvent?.({ type: "status", phase: "preparing_actions" });
		}

		const extraCreatedNames = collectActionCreatedEntityNames(parsed.actions);
		const allMentionCandidates = Array.from(
			new Set([...mentionCandidateNames, ...extraCreatedNames]),
		);

		const actionResult = await prepareChatActionCards(
			{
				storage,
				applyAiOperations,
				historyWriter,
				buildCustomMonsterChangeResources,
				fillCurrentTargetIds,
				applyMentionsToGeneratedContent,
				validateAiGeneratedContent,
			},
			{
				rawActions: parsed.actions,
				campaignSlug,
				sessionFileName: resolvedSessionFileName,
				encounterId: resolvedEncounterId,
				sceneId: resolvedSceneId,
				modelName: selectedModel,
				language: responseLanguage,
				simplifiedNotes,
				autoApply: effectiveAutoApply,
				mutationPermission: effectiveSettings.mutationPermission,
				mentionCandidateNames: allMentionCandidates,
			},
		);

		const normalizedReplySyntax = normalizeChatMentionsSyntax(parsed.reply);
		const processedReply =
			allMentionCandidates.length > 0
				? processGeneratedTextMentions(normalizedReplySyntax, allMentionCandidates)
				: normalizedReplySyntax;

		const now = Date.now();
		const userMessage = {
			id: `user-${storage.createId()}`,
			role: "user",
			content: normalizedUserText,
			timestamp: now,
			status: "done",
			...(attachmentList.length > 0 ? { attachments: attachmentList } : {}),
		};
		const assistantMessage = {
			id: `assistant-${storage.createId()}`,
			role: "assistant",
			content: processedReply,
			timestamp: now + 1,
			status: "done",
			...(actionResult.actionCards.length > 0 ? { actionCards: actionResult.actionCards } : {}),
		};

		const nextTitle = needsTitle
			? asText(parsed.chatTitle).slice(0, 80) || deriveFallbackTitle(cleanedText || normalizedUserText)
			: chat.title;
		const totalTokenEstimate =
			tokenEstimate + estimateTokensFromText(systemInstruction) + estimateTokensFromText(processedReply);

		const updatedChat = await chatRepository.update(campaignSlug, chat.id, {
			title: nextTitle,
			isAutoTitled: needsTitle ? true : chat.isAutoTitled,
			model: selectedModel,
			autoApply: effectiveAutoApply,
			contextSettings: effectiveSettings,
			anchor: effectiveAnchor ?? {
				type: contextPayload.workspace.viewType,
				title: contextPayload.workspace.sessionName || campaign?.name || campaignSlug,
				...(resolvedSessionFileName ? { sessionFileName: resolvedSessionFileName } : {}),
				...(resolvedEncounterId ? { encounterId: String(resolvedEncounterId) } : {}),
				...(resolvedSceneId ? { sceneId: String(resolvedSceneId) } : {}),
				pinned: false,
			},
			summary: compaction.summary,
			summarizedMessageCount: compaction.summarizedMessageCount,
			tokenEstimate: totalTokenEstimate,
			maxTokens,
			messages: [...chat.messages, userMessage, assistantMessage],
		});

		return {
			chat: updatedChat,
			userMessage,
			assistantMessage,
			updated: actionResult.updated,
			appliedActionIds: actionResult.appliedActionIds,
			changedEntityTypes: actionResult.changedEntityTypes,
			tokenEstimate: totalTokenEstimate,
			maxTokens,
			diceRolls,
		};
	}

	async function applyAction({ campaignSlug, chatId, actionId, payload = {} }) {
		const chat = await getChat({ campaignSlug, chatId });
		const location = findActionCardLocation(chat.messages, actionId);
		if (!location) throw createHttpError("Action card not found.", 404);
		if (location.card.status === "applied") {
			return {
				chat,
				actionCard: location.card,
				updated: null,
				aiResponse: null,
				changedEntityTypes: [],
			};
		}

		const campaign = await storage.readCampaign(campaignSlug);
		const settings = await storage.readSettings().catch(() => ({}));
		const responseLanguage = asText(payload.language || settings?.language || "uk");
		const workspaceContext = payload.workspaceContext && typeof payload.workspaceContext === "object"
			? payload.workspaceContext
			: {};
		const sessionFileName = asText(workspaceContext.sessionFileName || chat.anchor?.sessionFileName);
		const encounterId = workspaceContext.encounterId ?? chat.anchor?.encounterId ?? null;
		const sceneId = workspaceContext.sceneId ?? chat.anchor?.sceneId ?? null;

		const result = await applyChatActionCard(
			{
				storage,
				applyAiOperations,
				historyWriter,
				buildCustomMonsterChangeResources,
				validateAiGeneratedContent,
				restoreAiResponseSnapshot,
			},
			{
				actionCard: location.card,
				campaignSlug,
				sessionFileName,
				encounterId,
				sceneId,
				modelName: chat.model || "",
				language: responseLanguage,
				simplifiedNotes: Boolean(campaign?.simplifiedNotes),
				useDraftSnapshot: Boolean(payload.useDraftSnapshot),
			},
		);

		const nextMessages = replaceActionCardInMessages(chat.messages, location, result.actionCard);
		const updatedChat = await chatRepository.update(campaignSlug, chat.id, {
			messages: nextMessages,
		});

		return {
			chat: updatedChat,
			actionCard: result.actionCard,
			updated: result.updated,
			aiResponse: result.aiResponse,
			changedEntityTypes: result.changedEntityTypes,
		};
	}

	async function undoAction({ campaignSlug, chatId, actionId }) {
		const chat = await getChat({ campaignSlug, chatId });
		const location = findActionCardLocation(chat.messages, actionId);
		if (!location) throw createHttpError("Action card not found.", 404);
		if (location.card.status !== "applied") {
			throw createHttpError("Action card is not currently applied.", 400);
		}

		const result = await undoChatActionCard(
			{ storage, restoreAiResponseSnapshot },
			{ actionCard: location.card, campaignSlug },
		);

		const nextMessages = replaceActionCardInMessages(chat.messages, location, result.actionCard);
		const updatedChat = await chatRepository.update(campaignSlug, chat.id, {
			messages: nextMessages,
		});

		return {
			chat: updatedChat,
			actionCard: result.actionCard,
			updated: result.updated,
			aiResponse: result.aiResponse,
			changedEntityTypes: result.changedEntityTypes,
		};
	}

	async function rejectAction({ campaignSlug, chatId, actionId }) {
		const chat = await getChat({ campaignSlug, chatId });
		const location = findActionCardLocation(chat.messages, actionId);
		if (!location) throw createHttpError("Action card not found.", 404);
		if (location.card.status === "applied") {
			throw createHttpError("Applied action card must be undone instead of rejected.", 400);
		}

		const nextCard = {
			...location.card,
			status: "rejected",
		};
		const nextMessages = replaceActionCardInMessages(chat.messages, location, nextCard);
		const updatedChat = await chatRepository.update(campaignSlug, chat.id, {
			messages: nextMessages,
		});

		return {
			chat: updatedChat,
			actionCard: nextCard,
			updated: null,
			aiResponse: null,
			changedEntityTypes: [],
		};
	}

	return {
		listChats,
		getChat,
		createChat,
		updateChat,
		deleteChat,
		sendMessage,
		applyAction,
		undoAction,
		rejectAction,
	};
}

module.exports = { createAiChatCommands, extractStreamingReplyPreview };
