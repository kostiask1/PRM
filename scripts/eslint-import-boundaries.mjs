import path from "node:path";

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

function freezeSameLayerFileEdgeBaseline(baseline) {
	return Object.freeze(
		Object.fromEntries(
			Object.entries(baseline).map(([layer, entries]) => [
				layer,
				Object.freeze(
					Object.fromEntries(
						Object.entries(entries).map(([filePath, targetSlices]) => [
							filePath,
							Object.freeze([...targetSlices]),
						]),
					),
				),
			]),
		),
	);
}

export const FSD_SAME_LAYER_FILE_EDGE_BASELINE =
	freezeSameLayerFileEdgeBaseline({
		features: {
			"src/features/ai/ui/AiAssistantShell.tsx": ["modal"],
			"src/features/ai/ui/AiAttachmentControls.tsx": ["images"],
			"src/features/ai/ui/AiContextSettingsModal.tsx": ["modal"],
			"src/features/ai/ui/AiPromptComposer.tsx": ["editor"],
			"src/features/ai-edit-monster/ui/BestiaryAiDraftModal.tsx": ["ai"],
			"src/features/ai-edit-monster/ui/BestiaryAiModals.tsx": ["ai"],
			"src/features/ai-edit-monster/ui/MonsterAiActionModal.tsx": ["modal"],
			"src/features/ai-edit-monster/ui/MonsterAiEditModal.tsx": [
				"ai",
				"editor",
				"modal",
			],
			"src/features/dice/ui/DiceCalculator.tsx": ["modal"],
			"src/features/edit-monster/ui/MonsterFieldEditModal.tsx": ["modal"],
			"src/features/editor/ui/EditableField.tsx": ["entity-link"],
			"src/features/entity-link/ui/EntityModal.tsx": ["modal"],
			"src/features/images/ui/ImageAssetFieldView.tsx": ["modal"],
			"src/features/images/ui/ImageDropzone.tsx": ["modal"],
			"src/features/images/ui/ImageGallerySections.tsx": ["modal"],
			"src/features/images/ui/ImageGalleryView.tsx": ["modal"],
			"src/features/notes/ui/NoteCardParts.tsx": [
				"editor",
				"rich-content",
			],
			"src/features/rich-content/ui/RichContentRenderer.tsx": [
				"dice",
				"entity-link",
				"rules-reference",
			],
			"src/features/rules-reference/ui/RulesLink.tsx": ["dice"],
			"src/features/settings/ui/SettingsModalView.tsx": ["editor"],
		},
		widgets: {
			"src/widgets/ai-assistant/ui/AiAssistantPanel.tsx": [
				"ai-response-modal",
			],
			"src/widgets/ai-response-modal/ui/AiResponseModal.tsx": [
				"campaign-entity-card",
				"monster-editor-modal",
				"monster-stat-block",
			],
			"src/widgets/bestiary-browser/ui/BestiaryBrowser.tsx": [
				"ai-response-modal",
				"monster-editor-modal",
			],
			"src/widgets/bestiary-browser/ui/BestiaryContent.tsx": [
				"ai-assistant",
				"monster-stat-block",
			],
			"src/widgets/campaign-entity-modal/ui/CampaignEntityModalCard.tsx": [
				"campaign-entity-card",
			],
			"src/widgets/monster-editor-modal/ui/MonsterEditorModal.tsx": [
				"rules-reference-modal",
			],
			"src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx": [
				"monster-stat-block",
				"spells-browser",
			],
			"src/widgets/spells-browser/ui/SpellsBrowserContent.tsx": [
				"spell-card",
			],
		},
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
const FSD_PUBLIC_ENTRY_PATH_PATTERN = new RegExp(
	`^${FSD_PUBLIC_ENTRY_PATTERN}$`,
);

export const FSD_PUBLIC_API_PATTERNS = Object.freeze([
	Object.freeze({
		regex:
			`^(?:(?:\\.\\./)+|\\./|/src/)(?:${FSD_LAYERS.join("|")})/[^/]+/` +
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

function normalizeRepositoryFileName(fileName) {
	const normalized = String(fileName || "").replace(/\\/g, "/");
	if (normalized.startsWith("src/")) return normalized;
	const sourceRootIndex = normalized.lastIndexOf("/src/");
	return sourceRootIndex >= 0
		? normalized.slice(sourceRootIndex + 1)
		: normalized.replace(/^\.\//, "");
}

function getFsdSliceLocation(repositoryPath) {
	const [root, layer, slice, ...entryParts] = repositoryPath.split("/");
	if (root !== "src") return null;
	if (!FSD_LAYERS.includes(layer)) return null;
	if (!slice) return null;
	return { layer, slice, entryPath: entryParts.join("/") };
}

function getSameLayerImporter(fileName) {
	const repositoryFileName = normalizeRepositoryFileName(fileName);
	const location = getFsdSliceLocation(repositoryFileName);
	if (!location) return null;
	const { layer, slice: sourceSlice } = location;
	if (!Object.hasOwn(FSD_SAME_LAYER_FILE_EDGE_BASELINE, layer)) return null;
	return { fileName: repositoryFileName, layer, sourceSlice };
}

function isRelativeModuleSpecifier(specifier) {
	return typeof specifier === "string" && specifier.startsWith(".");
}

function resolveModuleSpecifierPath(importer, specifier) {
	if (typeof specifier !== "string") return null;
	const normalizedSpecifier = specifier.replace(/\\/g, "/");
	const cleanSpecifier = normalizedSpecifier.split(/[?#]/, 1)[0];
	if (cleanSpecifier.startsWith("/src/")) {
		return path.posix.normalize(cleanSpecifier).replace(/^\/+/, "");
	}
	if (!isRelativeModuleSpecifier(cleanSpecifier)) return null;
	return path.posix.normalize(
		path.posix.join(path.posix.dirname(importer.fileName), cleanSpecifier),
	);
}

function getCataloguedSiblingSlice(layer, sourceSlice, targetSlice) {
	if (!targetSlice) return null;
	if (targetSlice === sourceSlice) return null;
	if (!FSD_SLICE_NAMES[layer].includes(targetSlice)) return null;
	return targetSlice;
}

function resolveSameLayerTarget(importer, specifier) {
	const resolvedPath = resolveModuleSpecifierPath(importer, specifier);
	if (!resolvedPath) return null;
	const location = getFsdSliceLocation(resolvedPath);
	if (!location) return null;
	if (location.layer !== importer.layer) return null;
	return getCataloguedSiblingSlice(
		location.layer,
		importer.sourceSlice,
		location.slice,
	);
}

function getRequireSource(node) {
	const callee = node.callee;
	if (callee.type !== "Identifier") return undefined;
	if (callee.name !== "require") return undefined;
	return node.arguments[0];
}

function getTemplateQuasiValue(quasi) {
	const cooked = quasi.value.cooked;
	return typeof cooked === "string" ? cooked : quasi.value.raw;
}

function getTemplateLiteralSpecifier(source) {
	if (source.type !== "TemplateLiteral") return null;
	if (source.expressions.length !== 0) return null;
	const quasi = source.quasis[0];
	if (!quasi) return null;
	return getTemplateQuasiValue(quasi);
}

function getStaticModuleSpecifier(source) {
	if (!source) return null;
	if (typeof source.value === "string") return source.value;
	return getTemplateLiteralSpecifier(source);
}

function getTsImportTypeSource(node) {
	const argument = node.source ?? node.argument;
	return argument?.type === "TSLiteralType" ? argument.literal : argument;
}

function getTsExternalModuleSource(node) {
	return node.expression;
}

function createModuleReferenceVisitors(inspectLiteralSource, programExit) {
	const visitors = {
		ImportDeclaration(node) {
			inspectLiteralSource(node, node.source);
		},
		ExportNamedDeclaration(node) {
			if (node.source) inspectLiteralSource(node, node.source);
		},
		ExportAllDeclaration(node) {
			inspectLiteralSource(node, node.source);
		},
		ImportExpression(node) {
			inspectLiteralSource(node, node.source);
		},
		CallExpression(node) {
			inspectLiteralSource(node, getRequireSource(node));
		},
		TSImportType(node) {
			inspectLiteralSource(node, getTsImportTypeSource(node));
		},
		TSExternalModuleReference(node) {
			inspectLiteralSource(node, getTsExternalModuleSource(node));
		},
	};
	if (programExit) visitors["Program:exit"] = programExit;
	return visitors;
}

function isSameFsdSlice(source, target) {
	return (
		source?.layer === target.layer &&
		source.slice === target.slice
	);
}

function resolveFsdModuleTarget(importer, rawSpecifier) {
	const resolvedPath = resolveModuleSpecifierPath(importer, rawSpecifier);
	return resolvedPath ? getFsdSliceLocation(resolvedPath) : null;
}

function isPrivateExternalFsdTarget(importer, target) {
	if (!target) return false;
	const source = getFsdSliceLocation(importer.fileName);
	if (isSameFsdSlice(source, target)) return false;
	return !FSD_PUBLIC_ENTRY_PATH_PATTERN.test(target.entryPath);
}

function getPublicEntryViolation(importer, rawSpecifier) {
	const target = resolveFsdModuleTarget(importer, rawSpecifier);
	return isPrivateExternalFsdTarget(importer, target) ? { target } : null;
}

const FSD_PUBLIC_ENTRY_IMPORT_RULE = Object.freeze({
	meta: {
		type: "problem",
		docs: {
			description:
				"Require every cross-slice frontend module reference to use an explicit FSD public entry.",
		},
		schema: [],
		messages: {
			privateEntry:
				'Import "{{specifier}}" through the public entry of {{layer}}/{{slice}}.',
		},
	},
	create(context) {
		const importer = {
			fileName: normalizeRepositoryFileName(context.getFilename()),
		};
		if (!importer.fileName.startsWith("src/")) return {};

		const inspectLiteralSource = (node, source) => {
			const specifier = getStaticModuleSpecifier(source);
			const violation = getPublicEntryViolation(importer, specifier);
			if (!violation) return;
			context.report({
				node: source || node,
				messageId: "privateEntry",
				data: {
					specifier,
					layer: violation.target.layer,
					slice: violation.target.slice,
				},
			});
		};

		return createModuleReferenceVisitors(inspectLiteralSource);
	},
});

const FSD_SAME_LAYER_FILE_EDGE_RULE = Object.freeze({
	meta: {
		type: "problem",
		docs: {
			description:
				"Prevent feature and widget sibling-slice dependencies from growing beyond the exact audited file-edge baseline.",
		},
		schema: [],
		messages: {
			unexpected:
				'{{fileName}} may not add a same-layer dependency on "{{targetSlice}}". Remove the edge or explicitly lower/review the file-edge baseline.',
			stale:
				'Remove stale same-layer dependency allowance "{{targetSlice}}" from {{fileName}}.',
		},
	},
	create(context) {
		const importer = getSameLayerImporter(context.getFilename());
		if (!importer) return {};

		const allowedTargets = new Set(
			FSD_SAME_LAYER_FILE_EDGE_BASELINE[importer.layer][
				importer.fileName
			] || [],
		);
		const observedTargets = new Set();
		const reportedUnexpectedTargets = new Set();

		const inspectSpecifier = (node, rawSpecifier) => {
			const targetSlice = resolveSameLayerTarget(importer, rawSpecifier);
			if (!targetSlice) return;
			observedTargets.add(targetSlice);
			if (
				allowedTargets.has(targetSlice) ||
				reportedUnexpectedTargets.has(targetSlice)
			) {
				return;
			}
			reportedUnexpectedTargets.add(targetSlice);
			context.report({
				node,
				messageId: "unexpected",
				data: {
					fileName: importer.fileName,
					targetSlice,
				},
			});
		};

		const inspectLiteralSource = (node, source) => {
			inspectSpecifier(
				source || node,
				getStaticModuleSpecifier(source),
			);
		};

		return createModuleReferenceVisitors(
			inspectLiteralSource,
			(node) => {
				for (const targetSlice of allowedTargets) {
					if (observedTargets.has(targetSlice)) continue;
					context.report({
						node,
						messageId: "stale",
						data: {
							fileName: importer.fileName,
							targetSlice,
						},
					});
				}
			},
		);
	},
});

export const FSD_BOUNDARY_PLUGIN = Object.freeze({
	rules: Object.freeze({
		"public-entry-imports": FSD_PUBLIC_ENTRY_IMPORT_RULE,
		"same-layer-file-edges": FSD_SAME_LAYER_FILE_EDGE_RULE,
	}),
});

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
