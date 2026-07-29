export const FSD_SLICE_NAMES = Object.freeze({
	entities: Object.freeze([
		"bestiary",
		"campaign",
		"encounter",
		"reference",
		"session",
		"spell",
	]),
	features: Object.freeze([
		"ai",
		"ai-edit-monster",
		"backup",
		"campaign",
		"campaign-create",
		"campaign-entity",
		"clipboard",
		"dice",
		"edit-monster",
		"editor",
		"encounter-editor",
		"entity-link",
		"images",
		"modal",
		"monster-editor",
		"notes",
		"player-questions",
		"rich-content",
		"rules-reference",
		"session-editor",
		"settings",
		"status-badge",
	]),
	pages: Object.freeze([
		"bestiary",
		"campaign",
		"encounter",
		"session",
	]),
	widgets: Object.freeze([
		"ai-assistant",
		"ai-response-modal",
		"bestiary-browser",
		"campaign-entity-card",
		"campaign-entity-modal",
		"campaign-search",
		"monster-editor-modal",
		"monster-stat-block",
		"rules-reference-modal",
		"sidebar",
		"spell-card",
		"spells-browser",
	]),
});

const FSD_LAYERS = Object.keys(FSD_SLICE_NAMES);
const FSD_SLICE_NAME_PATTERN = Array.from(
	new Set(Object.values(FSD_SLICE_NAMES).flat()),
)
	.sort((left, right) => right.length - left.length)
	.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
	.join("|");
const FSD_PUBLIC_ENTRY_PATTERN =
	"(?:index(?:\\.(?:js|jsx|ts|tsx))?|model\\.js|graph\\.js|ui/index(?:\\.(?:js|jsx|ts|tsx))?)";

export const FSD_PUBLIC_API_PATTERNS = Object.freeze([
	Object.freeze({
		regex:
			`^(?:(?:\\.\\./)+|\\./)(?:${FSD_LAYERS.join("|")})/[^/]+/` +
			`(?!${FSD_PUBLIC_ENTRY_PATTERN}$).+`,
		message:
			"Import a cross-layer FSD slice through its public entry point.",
	}),
	Object.freeze({
		regex:
			`^(?:\\.\\./)+(?:${FSD_SLICE_NAME_PATTERN})/` +
			`(?!${FSD_PUBLIC_ENTRY_PATTERN}$).+`,
		message:
			"Import a same-layer FSD slice through its public entry point.",
	}),
]);

export const RECOVERED_ENTITY_PUBLIC_API_PATTERN = {
	group: [
		"**/entities/campaign/api/*",
		"**/entities/campaign/model/*",
		"**/entities/reference/api/*",
		"**/entities/reference/model/*",
		"**/entities/spell/api/*",
		"**/entities/spell/model/*",
	],
	message:
		"Import campaign, reference, and spell entities through their public entry points.",
};

export const TYPESCRIPT_PUBLIC_API_PATTERNS = [
	...FSD_PUBLIC_API_PATTERNS,
	{
		group: [
			"**/features/editor/ui/Input",
			"**/features/editor/ui/Input.jsx",
			"**/features/editor/ui/Input.tsx",
			"**/features/editor/ui/InputView",
			"**/features/editor/ui/InputView.tsx",
			"**/features/editor/ui/inputTypes",
			"**/features/editor/ui/inputTypes.ts",
			"**/features/editor/ui/EditableField",
			"**/features/editor/ui/EditableField.jsx",
			"**/features/editor/ui/EditableField.tsx",
			"**/features/editor/ui/MentionPickerModalContent",
			"**/features/editor/ui/MentionPickerModalContent.jsx",
			"**/features/editor/ui/MentionPickerModalContent.tsx",
		],
		message:
			"Import editor UI through features/editor/ui/index.js.",
	},
	{
		group: [
			"**/features/rules-reference/ui/*",
			"**/features/rules-reference/model/*",
		],
		message:
			"Import rules-reference behavior through features/rules-reference/index.js.",
	},
	RECOVERED_ENTITY_PUBLIC_API_PATTERN,
];

export const CAMPAIGN_MODEL_IMPORT_PATTERNS = [
	...TYPESCRIPT_PUBLIC_API_PATTERNS,
	{
		regex:
			"^(?:\\.\\./)+api(?:/|$)|^(?:\\.\\./)+index\\.(?:js|ts)$",
		message:
			"Campaign model code must stay transport-free; put API-backed orchestration in entities/campaign/api.",
	},
];

export const REFERENCE_LOADER_IMPORT_PATTERNS = [
	...TYPESCRIPT_PUBLIC_API_PATTERNS,
	{
		regex: "^(?:\\.\\./)+spell(?:/|$)",
		message:
			"Reference loaders must use entities/reference/api; spellApi owns spell queries only.",
	},
];
