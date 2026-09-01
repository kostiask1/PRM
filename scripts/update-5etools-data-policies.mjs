const CONDITION_PRUNE_KEYS = new Set([
	"page",
	"srd",
	"srd52",
	"basicRules2024",
	"basicRules",
	"source",
	"reprintedAs",
]);
const VARIANT_RULE_PRUNE_KEYS = new Set(CONDITION_PRUNE_KEYS);
const SKILL_PRUNE_KEYS = new Set(CONDITION_PRUNE_KEYS);
const SENSE_PRUNE_KEYS = new Set(CONDITION_PRUNE_KEYS);
const VARIANT_RULE_NAMES_WITH_INLINE_OBJECTS_TO_REMOVE = new Set([
	"Customizing Ability Scores",
]);
const CUSTOMIZING_ABILITY_SCORES_POINT_BUY_LINK =
	"[Point Buy Calculator](https://redcap.press/character-creation?method=Point+Buy)";
const SOURCE_PRIORITIES = new Map([
	["XPHB", 3],
	["XDMG", 3],
	["PHB", 2],
	["DMG", 2],
]);
const DRY_RUN_FLAGS = new Set(["--dry-run", "--check"]);
const HELP_FLAGS = new Set(["--help", "-h"]);

function hasAnyFlag(args, flags) {
	return [...flags].some((flag) => args.has(flag));
}

function getRefArgument(argv) {
	return argv.find((arg) => arg.startsWith("--ref="));
}

export function parseUpdaterArgs(argv, defaultRef = "main") {
	const args = new Set(argv.slice(2));
	const refArg = getRefArgument(argv);
	return {
		isDryRun: hasAnyFlag(args, DRY_RUN_FLAGS),
		keepSources: args.has("--keep-sources"),
		isVerbose: args.has("--verbose"),
		help: hasAnyFlag(args, HELP_FLAGS),
		ref: refArg ? refArg.slice("--ref=".length) : defaultRef,
	};
}

export function getUpdaterHelpText({
	owner,
	repo,
	imageOwner,
	imageRepo,
	imageRef,
	ref,
}) {
	return `Usage: node scripts/update-5etools-data.mjs [--dry-run] [--keep-sources] [--verbose] [--ref=main]

Downloads spell and bestiary JSON from:
  https://github.com/${owner}/${repo}/tree/${ref}/data/spells
  https://github.com/${owner}/${repo}/tree/${ref}/data/bestiary
  https://github.com/${owner}/${repo}/blob/${ref}/data/conditionsdiseases.json
  https://github.com/${owner}/${repo}/blob/${ref}/data/variantrules.json
  https://github.com/${owner}/${repo}/blob/${ref}/data/skills.json
  https://github.com/${owner}/${repo}/blob/${ref}/data/senses.json
  https://github.com/${owner}/${repo}/blob/${ref}/data/generated/gendata-nav-adventure-book-index.json
Downloads missing new bestiary tokens from:
  https://github.com/${imageOwner}/${imageRepo}/tree/${imageRef}/bestiary/{source}

Excluded files: fluff, foundry/foundy, template.
After download, materializes bestiary _copy entries and rebuilds all.json files.`;
}

export function isJsonFile(name) {
	return name.toLowerCase().endsWith(".json");
}

export function isExcludedDataFile(name) {
	const normalized = name.toLowerCase();
	return ["fluff", "foundry", "foundy", "template"].some((part) =>
		normalized.includes(part),
	);
}

export function shouldKeepRemoteFile(name) {
	return isJsonFile(name) && !isExcludedDataFile(name);
}

function projectRemoteFile(entry) {
	return {
		name: entry.name,
		downloadUrl: entry.download_url,
	};
}

function compareRemoteFileNames(left, right) {
	return left.name.localeCompare(right.name);
}

export function normalizeRemoteFileEntries(entries) {
	return entries
		.filter(
			(entry) =>
				entry.type === "file" && shouldKeepRemoteFile(entry.name),
		)
		.map(projectRemoteFile)
		.sort(compareRemoteFileNames);
}

export function ensureTrailingNewline(content) {
	return content.endsWith("\n") ? content : `${content}\n`;
}

function normalizeMonsterName(monster) {
	return String(monster?.name || "").trim().toLowerCase();
}

function normalizeMonsterSource(monster) {
	return String(monster?.source || "").trim().toUpperCase();
}

function createRequiredPairKey(first, second) {
	if (!first || !second) return "";
	return `${first}|${second}`;
}

export function normalizeMonsterKey(monster) {
	const name = normalizeMonsterName(monster);
	const source = normalizeMonsterSource(monster);
	return createRequiredPairKey(name, source);
}

export function isSafeTokenFileName(fileName) {
	if (!fileName) return false;
	if (/[<>:"/\\|?*\u0000-\u001F]/.test(fileName)) return false;
	return !/[. ]$/.test(fileName);
}

export function getTokenFileName(monster) {
	const name = String(monster?.name || "").trim();
	return name ? `${name}.webp` : "";
}

function getBestiaryMonsterList(data) {
	if (Array.isArray(data)) return data;
	return Array.isArray(data?.monster) ? data.monster : [];
}

export function collectMonstersFromBestiaryData(data) {
	return getBestiaryMonsterList(data).filter((monster) =>
		normalizeMonsterKey(monster),
	);
}

function isNewMonsterKey(key, currentKeys, seen) {
	return Boolean(key && !currentKeys.has(key) && !seen.has(key));
}

export function getNewMonsters(currentKeys, monsters = []) {
	const seen = new Set();
	const result = [];
	for (const monster of monsters) {
		const key = normalizeMonsterKey(monster);
		if (!isNewMonsterKey(key, currentKeys, seen)) continue;
		seen.add(key);
		result.push(monster);
	}
	return result;
}

function isExhaustionEntry(entry) {
	return String(entry?.name || "").toLowerCase() === "exhaustion";
}

export function getLocalExhaustionEntries(currentConditions) {
	const conditions = Array.isArray(currentConditions?.condition)
		? currentConditions.condition
		: [];
	return conditions.filter(isExhaustionEntry);
}

function normalizeConditionName(entry) {
	return String(entry?.name || "").trim().toLowerCase();
}

function normalizeConditionSource(entry) {
	return String(entry?.source || "").trim().toUpperCase();
}

export function conditionKey(entry) {
	return `${normalizeConditionName(entry)}|${normalizeConditionSource(entry)}`;
}

export function conditionNameKey(entry) {
	return normalizeConditionName(entry);
}

export function getSourcePriority(source) {
	const normalized = String(source || "").toUpperCase();
	return SOURCE_PRIORITIES.get(normalized) || 1;
}

function candidateHasPreferredBasicRules(current, candidate) {
	return candidate?.basicRules2024 && !current?.basicRules2024;
}

function currentHasPreferredBasicRules(current, candidate) {
	return !candidate?.basicRules2024 && current?.basicRules2024;
}

function getConditionSource(entry) {
	return entry?.source;
}

function pickConditionBySource(current, candidate) {
	const currentPriority = getSourcePriority(getConditionSource(current));
	const candidatePriority = getSourcePriority(getConditionSource(candidate));
	if (candidatePriority === currentPriority) return current;
	return candidatePriority > currentPriority ? candidate : current;
}

export function pickPreferredCondition(current, candidate) {
	if (!current) return candidate;
	if (candidateHasPreferredBasicRules(current, candidate)) return candidate;
	if (currentHasPreferredBasicRules(current, candidate)) return current;
	return pickConditionBySource(current, candidate);
}

function compareNamedEntries(left, right) {
	return String(left.name || "").localeCompare(String(right.name || ""));
}

export function dedupeConditionsByName(items = []) {
	const byName = new Map();
	for (const item of items) {
		const key = conditionNameKey(item);
		if (!key) continue;
		byName.set(key, pickPreferredCondition(byName.get(key), item));
	}
	return [...byName.values()].sort(compareNamedEntries);
}

function pruneMeta(item, pruneKeys) {
	if (!item || typeof item !== "object") return item;
	return Object.fromEntries(
		Object.entries(item).filter(([key]) => !pruneKeys.has(key)),
	);
}

export function pruneConditionMeta(item) {
	return pruneMeta(item, CONDITION_PRUNE_KEYS);
}

export function pruneVariantRuleMeta(item) {
	return pruneMeta(item, VARIANT_RULE_PRUNE_KEYS);
}

function isNotInlineObject(item) {
	return item?.type !== "inline";
}

function removeInlineObjectEntry([key, itemValue]) {
	return [key, removeInlineObjects(itemValue)];
}

export function removeInlineObjects(value) {
	if (Array.isArray(value)) {
		return value.filter(isNotInlineObject).map(removeInlineObjects);
	}
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(removeInlineObjectEntry),
	);
}

function hasPointBuyLink(rule) {
	return rule.entries.some((entry) =>
		String(entry || "").includes("https://redcap.press/character-creation"),
	);
}

export function addCustomizingAbilityScoresLink(rule) {
	if (!Array.isArray(rule?.entries)) return rule;
	if (hasPointBuyLink(rule)) return rule;
	return {
		...rule,
		entries: [...rule.entries, CUSTOMIZING_ABILITY_SCORES_POINT_BUY_LINK],
	};
}

function requiresInlineObjectCleanup(rule) {
	return VARIANT_RULE_NAMES_WITH_INLINE_OBJECTS_TO_REMOVE.has(
		String(rule?.name || ""),
	);
}

export function normalizeVariantRule(item) {
	const pruned = pruneVariantRuleMeta(item);
	if (!requiresInlineObjectCleanup(pruned)) return pruned;
	return addCustomizingAbilityScoresLink(removeInlineObjects(pruned));
}

export function pruneSkillMeta(item) {
	return pruneMeta(item, SKILL_PRUNE_KEYS);
}

export function pruneSenseMeta(item) {
	return pruneMeta(item, SENSE_PRUNE_KEYS);
}

export function normalizeConditionsData(data) {
	return {
		condition: dedupeConditionsByName(data.condition || []).map(
			pruneConditionMeta,
		),
		status: dedupeConditionsByName(data.status || []).map(
			pruneConditionMeta,
		),
	};
}

export function normalizeDiseasesData(data) {
	return {
		disease: dedupeConditionsByName(data.disease || []).map(
			pruneConditionMeta,
		),
	};
}

export function normalizeVariantRulesData(data) {
	return {
		variantrule: dedupeConditionsByName(data.variantrule || []).map(
			normalizeVariantRule,
		),
	};
}

export function normalizeSkillsData(data) {
	return {
		skill: dedupeConditionsByName(data.skill || []).map(pruneSkillMeta),
	};
}

export function normalizeSensesData(data) {
	return {
		sense: dedupeConditionsByName(data.sense || []).map(pruneSenseMeta),
	};
}

function ensureDownloadedConditions(downloaded) {
	if (!Array.isArray(downloaded.condition)) downloaded.condition = [];
	return downloaded.condition;
}

function appendMissingCondition(conditions, existing, entry) {
	const key = conditionKey(entry);
	if (existing.has(key)) return;
	conditions.push(entry);
	existing.add(key);
}

export function appendLocalExhaustion(downloaded, localExhaustion) {
	if (localExhaustion.length === 0) return;
	const conditions = ensureDownloadedConditions(downloaded);
	const existing = new Set(conditions.map(conditionKey));
	for (const entry of localExhaustion) {
		appendMissingCondition(conditions, existing, entry);
	}
}

function getTrimmedSourceField(item, field) {
	return String(item?.[field] || "").trim();
}

function projectSourceEntry(item) {
	const name = getTrimmedSourceField(item, "name");
	const source = getTrimmedSourceField(item, "source");
	return { name, source };
}

function sourceEntryKey(entry) {
	return `${entry.name.toLowerCase()}|${entry.source.toUpperCase()}`;
}

function appendSourceEntry(result, seen, item) {
	const entry = projectSourceEntry(item);
	if (!entry.name || !entry.source) return;
	const key = sourceEntryKey(entry);
	if (seen.has(key)) return;
	seen.add(key);
	result.push(entry);
}

function appendSourceSection(result, seen, section) {
	if (!Array.isArray(section)) return;
	for (const item of section) appendSourceEntry(result, seen, item);
}

export function normalizeSourceEntries(data) {
	const seen = new Set();
	const result = [];
	for (const section of [data?.adventure, data?.book]) {
		appendSourceSection(result, seen, section);
	}
	return result.sort(compareNamedEntries);
}

export function isJsonDirectoryFile(entry) {
	return entry.isFile() && isJsonFile(entry.name);
}
