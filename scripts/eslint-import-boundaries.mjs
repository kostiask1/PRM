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
