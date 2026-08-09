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
		features: {},
		widgets: {},
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
const APP_STORE_RUNTIME_PATH = "src/shared/model/appStoreRuntime.ts";
const APP_STORE_RUNTIME_OWNER_PATH = "src/app/model/appStore.ts";
const APP_STORE_RUNTIME_FACADE_PATH = "src/shared/model/appStore.ts";
const APP_STORE_RUNTIME_ALLOWED_IMPORTERS = new Set([
	APP_STORE_RUNTIME_OWNER_PATH.toLowerCase(),
	APP_STORE_RUNTIME_FACADE_PATH.toLowerCase(),
]);
const APP_STORE_RUNTIME_MODULE_PATH = normalizeModulePath(
	APP_STORE_RUNTIME_PATH,
);
const SETTINGS_FEATURE_PATH_PREFIX = "src/features/settings/";
const NOTES_FEATURE_PATH_PREFIX = "src/features/notes/";
const PLAYER_QUESTIONS_FEATURE_PATH_PREFIX = "src/features/player-questions/";
const CAMPAIGN_ENTITY_FEATURE_PATH_PREFIX = "src/features/campaign-entity/";
const ENCOUNTER_EDITOR_FEATURE_PATH_PREFIX = "src/features/encounter-editor/";
const RULES_REFERENCE_FEATURE_PATH_PREFIX = "src/features/rules-reference/";
const SHARED_MODEL_PATH = "src/shared/model";
const APP_MODEL_PATH = "src/app/model";

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
	const lowerCasePath = normalized.toLowerCase();
	if (lowerCasePath.startsWith("src/")) return lowerCasePath;
	const sourceRootIndex = lowerCasePath.lastIndexOf("/src/");
	return sourceRootIndex >= 0
		? lowerCasePath.slice(sourceRootIndex + 1)
		: lowerCasePath.replace(/^\.\//, "");
}

function normalizeModulePath(fileName) {
	if (typeof fileName !== "string") return null;
	return fileName
		.replace(/(?:\.d)?\.(?:[cm]?[jt]sx?)$/, "")
		.toLowerCase();
}

function getFsdSliceLocation(repositoryPath) {
	const [root, layer, slice, ...entryParts] = repositoryPath.split("/");
	if (root !== "src") return null;
	if (!FSD_LAYERS.includes(layer)) return null;
	if (!slice) return null;
	return { layer, slice, entryPath: entryParts.join("/") };
}

function getSameLayerImporter(fileName, baseline) {
	const repositoryFileName = normalizeRepositoryFileName(fileName);
	const location = getFsdSliceLocation(repositoryFileName);
	if (!location) return null;
	const { layer, slice: sourceSlice } = location;
	if (!Object.hasOwn(baseline, layer)) return null;
	return { fileName: repositoryFileName, layer, sourceSlice };
}

function isRelativeModuleSpecifier(specifier) {
	return typeof specifier === "string" && specifier.startsWith(".");
}

function normalizeResolvedModulePath(modulePath) {
	return path.posix
		.normalize(modulePath)
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
		.toLowerCase();
}

function getRepositorySourcePath(fileName) {
	const repositoryPath = normalizeRepositoryFileName(fileName);
	return repositoryPath.startsWith("src/") ? repositoryPath : null;
}

function resolveFileSystemModulePath(canonicalSpecifier) {
	const lowerCaseSpecifier = canonicalSpecifier.toLowerCase();
	if (lowerCaseSpecifier.startsWith("/@fs/")) {
		return getRepositorySourcePath(
			canonicalSpecifier.slice("/@fs/".length),
		);
	}
	if (/^[a-z]:\//i.test(canonicalSpecifier)) {
		return getRepositorySourcePath(canonicalSpecifier);
	}
	return null;
}

function resolveModuleSpecifierPath(importer, specifier) {
	if (typeof specifier !== "string") return null;
	const normalizedSpecifier = specifier.replace(/\\/g, "/");
	const cleanSpecifier = normalizedSpecifier.split(/[?#]/, 1)[0];
	const canonicalSpecifier = path.posix.normalize(cleanSpecifier);
	const fileSystemModulePath = resolveFileSystemModulePath(canonicalSpecifier);
	if (fileSystemModulePath) return fileSystemModulePath;
	if (canonicalSpecifier.toLowerCase().startsWith("/src/")) {
		return normalizeResolvedModulePath(canonicalSpecifier);
	}
	if (!isRelativeModuleSpecifier(cleanSpecifier)) return null;
	return normalizeResolvedModulePath(
		path.posix.join(path.posix.dirname(importer.fileName), canonicalSpecifier),
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

function getMemberPropertyName(member) {
	if (member.computed) return getStaticModuleSpecifier(member.property);
	return member.property.type === "Identifier" ? member.property.name : null;
}

function isImportMetaMetaProperty(node) {
	if (node.type !== "MetaProperty") return false;
	return node.meta.name === "import" && node.property.name === "meta";
}

function isImportMetaGlobCallee(callee) {
	if (callee.type !== "MemberExpression") return false;
	if (!isImportMetaMetaProperty(callee.object)) return false;
	const propertyName = getMemberPropertyName(callee);
	return propertyName === "glob" || propertyName === "globEager";
}

function getModulePatternSources(source) {
	if (!source) return [];
	if (source.type !== "ArrayExpression") return [source];
	return source.elements.filter(Boolean);
}

function getImportMetaGlobSources(node) {
	if (!isImportMetaGlobCallee(node.callee)) return [];
	return getModulePatternSources(node.arguments[0]);
}

function getCallModuleSources(node) {
	const requireSource = getRequireSource(node);
	return requireSource ? [requireSource] : getImportMetaGlobSources(node);
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
			for (const source of getCallModuleSources(node)) {
				inspectLiteralSource(node, source);
			}
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

export function createFsdSameLayerFileEdgeRule(
	baseline = FSD_SAME_LAYER_FILE_EDGE_BASELINE,
) {
	return Object.freeze({
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
			const importer = getSameLayerImporter(context.getFilename(), baseline);
			if (!importer) return {};

			const baselineTargets = Object.entries(
				baseline[importer.layer] || {},
			).find(
				([fileName]) =>
					normalizeRepositoryFileName(fileName) === importer.fileName,
			)?.[1];
			const allowedTargets = new Set(
				baselineTargets || [],
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
}

const FSD_SAME_LAYER_FILE_EDGE_RULE = createFsdSameLayerFileEdgeRule();

const APP_STORE_RUNTIME_OWNER_RULE = Object.freeze({
	meta: {
		type: "problem",
		docs: {
			description:
				"Reserve the shared app-store runtime registration port for the app-owned composition root and its compatibility facade.",
		},
		schema: [],
		messages: {
			privateRuntime:
				"Only src/app/model/appStore.ts and src/shared/model/appStore.ts may import the app-store runtime registration port.",
		},
	},
	create(context) {
		const importer = {
			fileName: normalizeRepositoryFileName(context.getFilename()),
		};
		if (
			APP_STORE_RUNTIME_ALLOWED_IMPORTERS.has(
				importer.fileName.toLowerCase(),
			)
		) {
			return {};
		}

		const inspectLiteralSource = (node, source) => {
			const specifier = getStaticModuleSpecifier(source);
			const resolvedModulePath = normalizeModulePath(
				resolveModuleSpecifierPath(importer, specifier),
			);
			if (resolvedModulePath !== APP_STORE_RUNTIME_MODULE_PATH) {
				return;
			}
			context.report({
				node: source || node,
				messageId: "privateRuntime",
			});
		};

		return createModuleReferenceVisitors(inspectLiteralSource);
	},
});

function isModulePathWithin(modulePath, rootPath) {
	return (
		modulePath === rootPath || modulePath.startsWith(`${rootPath}/`)
	);
}

function getGlobalStoreTarget(importer, source) {
	const specifier = getStaticModuleSpecifier(source);
	const modulePath = normalizeModulePath(
		resolveModuleSpecifierPath(importer, specifier),
	);
	if (!modulePath) return null;
	if (isModulePathWithin(modulePath, SHARED_MODEL_PATH)) {
		return "shared";
	}
	return isModulePathWithin(modulePath, APP_MODEL_PATH)
		? "app"
		: null;
}

function createInjectedRuntimeStoreFacadeRule({
	featurePathPrefix,
	description,
	messageId,
	message,
}) {
	return Object.freeze({
		meta: {
			type: "problem",
			docs: { description },
			schema: [],
			messages: { [messageId]: message },
		},
		create(context) {
			const importer = {
				fileName: normalizeRepositoryFileName(context.getFilename()),
			};
			if (!importer.fileName.startsWith(featurePathPrefix)) return {};

			const inspectOpaqueReference = (node, source) => {
				if (!getGlobalStoreTarget(importer, source)) return;
				context.report({ node: source || node, messageId });
			};

			return createModuleReferenceVisitors(inspectOpaqueReference);
		},
	});
}

const SETTINGS_STORE_FACADE_RULE = createInjectedRuntimeStoreFacadeRule({
	featurePathPrefix: SETTINGS_FEATURE_PATH_PREFIX,
	description:
		"Require Settings to receive global-store access through its injected runtime.",
	messageId: "injectedRuntime",
	message:
		"Settings must receive app-global state through its injected Settings runtime and may not import shared/model or app/model directly.",
});

const NOTES_STORE_FACADE_RULE = createInjectedRuntimeStoreFacadeRule({
	featurePathPrefix: NOTES_FEATURE_PATH_PREFIX,
	description:
		"Require Notes to receive simplified-note presentation state through its injected provider.",
	messageId: "injectedRuntime",
	message:
		"Notes must receive simplified-note presentation state through SimplifiedNotesProvider and may not import shared/model or app/model directly.",
});

const PLAYER_QUESTIONS_STORE_FACADE_RULE = createInjectedRuntimeStoreFacadeRule({
	featurePathPrefix: PLAYER_QUESTIONS_FEATURE_PATH_PREFIX,
	description:
		"Require Player Questions to receive dice state and requests through its injected runtime.",
	messageId: "injectedRuntime",
	message:
		"Player Questions must receive app-global dice state and requests through its injected runtime and may not import shared/model or app/model directly.",
});

const CAMPAIGN_ENTITY_STORE_FACADE_RULE =
	createInjectedRuntimeStoreFacadeRule({
		featurePathPrefix: CAMPAIGN_ENTITY_FEATURE_PATH_PREFIX,
		description:
			"Require Campaign Entity to receive app-global refresh effects through injected commands.",
		messageId: "injectedRuntime",
		message:
			"Campaign Entity must receive app-global refresh effects through injected commands and may not import shared/model or app/model directly.",
	});

const ENCOUNTER_EDITOR_STORE_FACADE_RULE =
	createInjectedRuntimeStoreFacadeRule({
		featurePathPrefix: ENCOUNTER_EDITOR_FEATURE_PATH_PREFIX,
		description:
			"Require Encounter Editor to receive app-global modal and refresh effects through its injected runtime.",
		messageId: "injectedRuntime",
		message:
			"Encounter Editor must receive app-global modal and refresh effects through its injected runtime and may not import shared/model or app/model directly.",
	});

const RULES_REFERENCE_STORE_FACADE_RULE =
	createInjectedRuntimeStoreFacadeRule({
		featurePathPrefix: RULES_REFERENCE_FEATURE_PATH_PREFIX,
		description:
			"Require Rules Reference to receive app-global navigation and error effects through its injected runtime.",
		messageId: "injectedRuntime",
		message:
			"Rules Reference must receive app-global navigation and error effects through its injected runtime and may not import shared/model or app/model directly.",
	});

export const FSD_BOUNDARY_PLUGIN = Object.freeze({
	rules: Object.freeze({
		"public-entry-imports": FSD_PUBLIC_ENTRY_IMPORT_RULE,
		"same-layer-file-edges": FSD_SAME_LAYER_FILE_EDGE_RULE,
		"app-store-runtime-owner": APP_STORE_RUNTIME_OWNER_RULE,
		"settings-store-facade": SETTINGS_STORE_FACADE_RULE,
		"notes-store-facade": NOTES_STORE_FACADE_RULE,
		"player-questions-store-facade": PLAYER_QUESTIONS_STORE_FACADE_RULE,
		"campaign-entity-store-facade": CAMPAIGN_ENTITY_STORE_FACADE_RULE,
		"encounter-editor-store-facade": ENCOUNTER_EDITOR_STORE_FACADE_RULE,
		"rules-reference-store-facade": RULES_REFERENCE_STORE_FACADE_RULE,
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

export const SHARED_MODAL_PUBLIC_API_PATTERN = Object.freeze({
	group: Object.freeze([
		"**/shared/ui/Modal",
		"**/shared/ui/Modal.*",
		"**/shared/ui/ModalView",
		"**/shared/ui/ModalView.*",
		"**/shared/ui/useModalController",
		"**/shared/ui/useModalController.*",
		"**/shared/ui/modalModel",
		"**/shared/ui/modalModel.*",
	]),
	message:
		"Import Modal through shared/ui/index.js; its view, controller, and model are private.",
});

export const TYPESCRIPT_PUBLIC_API_PATTERNS = [
	...FSD_PUBLIC_API_PATTERNS,
	SHARED_MODAL_PUBLIC_API_PATTERN,
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
