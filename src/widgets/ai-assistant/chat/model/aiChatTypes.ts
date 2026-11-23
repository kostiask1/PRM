import type {
	AiChatContextPreview,
	AiChatStreamPhase,
	AiContextCatalogItem,
	AiHistoryResource,
} from "../../../../features/ai/index.js";

export type { AiChatContextPreview, AiContextCatalogItem };

export type AiMessageRole = "user" | "assistant" | "system";

export type AiActionCardType = "atomic" | "diff";

export type AiActionCardStatus = "pending" | "applied" | "rejected" | "undone";

export type AiActionCardStatKind =
	| "character"
	| "npc"
	| "location"
	| "entity"
	| "monster"
	| "words"
	| "note"
	| "session"
	| "scene"
	| "session_npc"
	| "session_location"
	| "encounter";

export interface AiActionCardStat {
	label: string;
	value: string;
	type?: "added" | "changed" | "info" | "neutral";
	kind?: AiActionCardStatKind;
	op?: "added" | "changed" | "removed";
	count?: number;
	delta?: number;
}

export type CompactContextFeedback =
	| {
			kind: "compacted";
			compactedCount: number;
			previousHistoryTokens: number;
			nextHistoryTokens: number;
	  }
	| { kind: "already_compacted" };

export interface AiActionCard {
	id: string;
	type: AiActionCardType;
	title: string;
	subtitle?: string;
	description?: string;
	targetEntity?: string;
	targetType?:
		| "campaign"
		| "session"
		| "scene"
		| "npc"
		| "character"
		| "location"
		| "encounter"
		| "monster"
		| "note";
	stats?: AiActionCardStat[];
	status: AiActionCardStatus;
	diffSnippet?: {
		before?: string;
		after?: string;
	};
	diffResources?: AiHistoryResource[];
	operations?: unknown[];
	aiResponseId?: string | null;
	appliedAt?: number | null;
	payload?: unknown;
}

export interface AiChatAttachment {
	id: string;
	name: string;
	size?: number;
	sizeBytes?: number;
	type?: string;
	mimeType?: string;
	kind?: "image" | "file";
	data?: string;
	url?: string;
}

export interface ChatMessage {
	id: string;
	role: AiMessageRole;
	content: string;
	timestamp: number;
	status?: "pending" | "streaming" | "done" | "error";
	streamPhase?: AiChatStreamPhase;
	actionCards?: AiActionCard[];
	attachments?: AiChatAttachment[];
	imageUrl?: string;
	errorMessage?: string;
}

export interface AiContextSettings {
	includeCurrentScene: boolean;
	includeCampaignCharacters?: boolean;
	includeCampaignNpc: boolean;
	includeCampaignLocations: boolean;
	includeRecentSessionHistory: boolean;
	includeBestiary: boolean;
	selectedCharacterIds?: string[] | null;
	selectedNpcIds?: string[] | null;
	selectedLocationIds?: string[] | null;
	selectedSceneIds?: string[] | null;
	selectedSessionFileNames?: string[] | null;
	selectedBestiaryIds?: string[] | null;
	mutationPermission: "diff_only" | "direct_mutation";
	responseTone: "concise" | "narrative" | "rules_strict";
	rulesEdition?: "5.5e" | "5e";
}

export interface AiChatAnchorData {
	type: "campaign" | "session" | "encounter" | "bestiary" | "general" | string;
	title: string;
	sessionFileName?: string;
	encounterId?: string;
	sceneId?: string;
	pinned?: boolean;
}

export interface AiChatSession {
	id: string;
	campaignSlug?: string;
	title: string;
	isAutoTitled?: boolean;
	isLegacyArchive?: boolean;
	createdAt: number;
	updatedAt: number;
	model: string;
	messages: ChatMessage[];
	autoApply: boolean;
	contextSettings?: AiContextSettings;
	anchor?: AiChatAnchorData | null;
	summary?: string;
	summarizedMessageCount?: number;
	tokenEstimate?: number;
	maxTokens?: number;
}

export interface AiChatSessionSummary {
	id: string;
	campaignSlug?: string;
	title: string;
	isAutoTitled?: boolean;
	isLegacyArchive?: boolean;
	createdAt: number;
	updatedAt: number;
	model: string;
	autoApply: boolean;
	messageCount: number;
	userMessageCount: number;
	tokenEstimate?: number;
	maxTokens?: number;
}

export interface AiContextAnchor {
	type: "campaign" | "session" | "encounter" | "bestiary" | "general";
	title: string;
	subtitle?: string;
	synced: boolean;
	pinned: boolean;
	tokenEstimate: number;
	maxTokens: number;
	sessionFileName?: string;
	encounterId?: string;
	sceneId?: string;
}

export interface AiWorkspaceContext {
	viewType: "campaign" | "session" | "encounter" | "bestiary";
	campaignSlug: string;
	sessionFileName?: string | null;
	encounterId?: string | number | null;
	sceneId?: string | number | null;
	activeSection?: string;
}

export interface AiCommandItem {
	command: string;
	name: string;
	description: string;
	example: string;
	category?: "scene" | "entities" | "combat" | "system";
}

export interface AiModelOption {
	id: string;
	name: string;
	description: string;
	badge?: string;
	contextWindow?: string;
	inputTokenLimit?: number;
}
