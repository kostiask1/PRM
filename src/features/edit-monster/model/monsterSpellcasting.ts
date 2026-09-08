import type {
	MonsterData,
	MonsterSpellLevel,
	MonsterSpellcasting,
} from "../../../entities/bestiary/index.js";

export const MONSTER_SPELLCASTING_SCALAR_KEYS = [
	"name",
	"type",
	"ability",
	"displayAs",
	"chargesItem",
] as const;

export const MONSTER_SPELLCASTING_RICH_LIST_KEYS = [
	"headerEntries",
	"footerEntries",
	"will",
	"ritual",
] as const;

export const MONSTER_SPELLCASTING_BUCKET_KEYS = [
	"daily",
	"rest",
	"restLong",
	"recharge",
	"legendary",
	"charges",
] as const;

export type MonsterSpellcastingScalarKey =
	(typeof MONSTER_SPELLCASTING_SCALAR_KEYS)[number];

export type MonsterSpellcastingRichListKey =
	(typeof MONSTER_SPELLCASTING_RICH_LIST_KEYS)[number];

export type MonsterSpellcastingBucketKey =
	(typeof MONSTER_SPELLCASTING_BUCKET_KEYS)[number];

export type MonsterSpellcastingBlock = MonsterSpellcasting;

export type MonsterSpellcastingItemTarget =
	| {
			kind: "rich";
			key: MonsterSpellcastingRichListKey;
	  }
	| {
			kind: "bucket";
			key: MonsterSpellcastingBucketKey;
			group: string;
	  }
	| {
			kind: "level";
			level: string;
	  };

export interface MonsterSpellcastingBucketGroup {
	key: string;
	items: unknown[];
}

export interface MonsterSpellcastingLevel {
	level: string;
	slots?: number;
	lower?: number | boolean;
	spells: unknown[];
}

export interface MonsterSpellcastingLevelPatch {
	slots?: number | null;
	lower?: number | boolean | null;
}

const DEFAULT_SPELLCASTING_BLOCK: MonsterSpellcastingBlock = {
	name: "Spellcasting",
	type: "spellcasting",
	headerEntries: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, key);
}

function cloneValue<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => cloneValue(item)) as T;
	}
	if (!isRecord(value)) return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
	) as T;
}

function getStoredBlockValues(monster: MonsterData): unknown[] {
	const value: unknown = monster.spellcasting;
	if (Array.isArray(value)) return value;
	return isRecord(value) ? [value] : [];
}

function getStoredBlocks(monster: MonsterData): MonsterSpellcastingBlock[] {
	return getStoredBlockValues(monster).map((block) =>
		isRecord(block) ? (block as MonsterSpellcastingBlock) : {},
	);
}

function updateBlockAt(
	monster: MonsterData,
	blockIndex: number,
	updater: (block: MonsterSpellcastingBlock) => MonsterSpellcastingBlock,
): MonsterData {
	const storedValues = getStoredBlockValues(monster);
	if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= storedValues.length) {
		return monster;
	}
	const currentValue = storedValues[blockIndex];
	const current = isRecord(currentValue)
		? (currentValue as MonsterSpellcastingBlock)
		: {};
	const next = updater(current);
	if (next === current) return monster;
	const nextBlocks = storedValues.slice();
	nextBlocks[blockIndex] = next;
	return {
		...monster,
		spellcasting: nextBlocks as MonsterSpellcastingBlock[],
	};
}

function getRecordProperty(
	record: MonsterSpellcastingBlock,
	key: string,
): Record<string, unknown> {
	return isRecord(record[key]) ? record[key] : {};
}

function getStoredLevels(
	block: MonsterSpellcastingBlock,
): Record<string, MonsterSpellLevel> {
	const value: unknown = block.spells;
	return isRecord(value) ? (value as Record<string, MonsterSpellLevel>) : {};
}

function getStoredItems(
	block: MonsterSpellcastingBlock,
	target: MonsterSpellcastingItemTarget,
): unknown[] {
	if (target.kind === "rich") {
		const value = block[target.key];
		return Array.isArray(value) ? value : [];
	}
	if (target.kind === "bucket") {
		const groups = getRecordProperty(block, target.key);
		const value = groups[target.group];
		return Array.isArray(value) ? value : [];
	}
	const levels = getStoredLevels(block);
	const storedLevel = levels[target.level];
	const level = isRecord(storedLevel) ? storedLevel : {};
	const spells = level.spells;
	return Array.isArray(spells) ? spells : [];
}

function updateItems(
	monster: MonsterData,
	blockIndex: number,
	target: MonsterSpellcastingItemTarget,
	updater: (items: unknown[]) => unknown[],
): MonsterData {
	return updateBlockAt(monster, blockIndex, (block) => {
		const nextItems = updater(getStoredItems(block, target));
		if (target.kind === "rich") {
			return { ...block, [target.key]: nextItems };
		}
		if (target.kind === "bucket") {
			const groups = getRecordProperty(block, target.key);
			return {
				...block,
				[target.key]: { ...groups, [target.group]: nextItems },
			};
		}
		const levels = getStoredLevels(block);
		const storedLevel = levels[target.level];
		const level = isRecord(storedLevel) ? storedLevel : {};
		return {
			...block,
			spells: {
				...levels,
				[target.level]: { ...level, spells: nextItems },
			},
		};
	});
}

function normalizeMapKey(value: unknown): string {
	return String(value ?? "").trim();
}

function readOptionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalLower(value: unknown): number | boolean | undefined {
	return typeof value === "boolean" ? value : readOptionalNumber(value);
}

function updateMapKey<TValue>(
	map: Record<string, TValue>,
	oldKey: string,
	newKey: string,
): Record<string, TValue> {
	return Object.fromEntries(
		Object.entries(map).map(([key, value]) =>
			key === oldKey ? [newKey, value] : [key, value],
		),
	);
}

/**
 * Returns detached, record-shaped blocks while retaining source-array positions.
 * A malformed row is exposed as an empty block so subsequent indexed edits stay aligned.
 */
export function getMonsterSpellcastingBlocks(
	monster: MonsterData,
): MonsterSpellcastingBlock[] {
	return getStoredBlocks(monster).map((block) =>
		cloneValue(block),
	);
}

export function getMonsterSpellcastingScalar(
	block: MonsterSpellcastingBlock,
	key: MonsterSpellcastingScalarKey,
): string {
	return String(block[key] ?? "");
}

export function getMonsterSpellcastingItems(
	block: MonsterSpellcastingBlock,
	target: MonsterSpellcastingItemTarget,
): unknown[] {
	return cloneValue(getStoredItems(block, target));
}

export function getMonsterSpellcastingItemText(item: unknown): string {
	if (typeof item === "string") return item;
	if (isRecord(item) && typeof item.entry === "string") return item.entry;
	if (item === undefined) return "";
	try {
		return JSON.stringify(item, null, 2) ?? String(item);
	} catch {
		return String(item);
	}
}

export function getMonsterSpellcastingBucketGroups(
	block: MonsterSpellcastingBlock,
	key: MonsterSpellcastingBucketKey,
): MonsterSpellcastingBucketGroup[] {
	return Object.entries(getRecordProperty(block, key)).map(
		([groupKey, items]) => ({
			key: groupKey,
			items: Array.isArray(items) ? cloneValue(items) : [],
		}),
	);
}

export function getMonsterSpellcastingLevels(
	block: MonsterSpellcastingBlock,
): MonsterSpellcastingLevel[] {
	return Object.entries(getStoredLevels(block)).map(
		([levelKey, value]) => {
			const level = isRecord(value) ? value : {};
			return {
				level: levelKey,
				...(readOptionalNumber(level.slots) === undefined
					? {}
					: { slots: readOptionalNumber(level.slots) }),
				...(readOptionalLower(level.lower) === undefined
					? {}
					: { lower: readOptionalLower(level.lower) }),
				spells: Array.isArray(level.spells) ? cloneValue(level.spells) : [],
			};
		},
	);
}

export function addMonsterSpellcastingBlock(
	monster: MonsterData,
	initial: MonsterSpellcastingBlock = DEFAULT_SPELLCASTING_BLOCK,
): MonsterData {
	return {
		...monster,
		spellcasting: [
			...getStoredBlockValues(monster),
			cloneValue(initial),
		] as MonsterSpellcastingBlock[],
	};
}

export function updateMonsterSpellcastingBlock(
	monster: MonsterData,
	blockIndex: number,
	patch: Readonly<MonsterSpellcastingBlock>,
): MonsterData {
	const entries = Object.entries(patch);
	if (entries.length === 0) return monster;
	return updateBlockAt(monster, blockIndex, (block) => {
		if (entries.every(([key, value]) => Object.is(block[key], value))) {
			return block;
		}
		return { ...block, ...cloneValue(patch) };
	});
}

export function removeMonsterSpellcastingBlock(
	monster: MonsterData,
	blockIndex: number,
): MonsterData {
	const blocks = getStoredBlockValues(monster);
	if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blocks.length) {
		return monster;
	}
	return {
		...monster,
		spellcasting: blocks.filter(
			(_block, index) => index !== blockIndex,
		) as MonsterSpellcastingBlock[],
	};
}

export function moveMonsterSpellcastingBlock(
	monster: MonsterData,
	fromIndex: number,
	toIndex: number,
): MonsterData {
	const blocks = getStoredBlockValues(monster);
	if (
		!Number.isInteger(fromIndex) ||
		!Number.isInteger(toIndex) ||
		fromIndex < 0 ||
		fromIndex >= blocks.length ||
		toIndex < 0 ||
		toIndex >= blocks.length ||
		fromIndex === toIndex
	) {
		return monster;
	}
	const nextBlocks = blocks.slice();
	const [block] = nextBlocks.splice(fromIndex, 1);
	nextBlocks.splice(toIndex, 0, block);
	return {
		...monster,
		spellcasting: nextBlocks as MonsterSpellcastingBlock[],
	};
}

export function updateMonsterSpellcastingScalar(
	monster: MonsterData,
	blockIndex: number,
	key: MonsterSpellcastingScalarKey,
	value: string | undefined,
): MonsterData {
	return updateBlockAt(monster, blockIndex, (block) => {
		if (value === undefined) {
			if (!hasOwn(block, key)) return block;
			const next = { ...block };
			delete next[key];
			return next;
		}
		return Object.is(block[key], value) ? block : { ...block, [key]: value };
	});
}

export function addMonsterSpellcastingItem(
	monster: MonsterData,
	blockIndex: number,
	target: MonsterSpellcastingItemTarget,
	item: unknown = "",
): MonsterData {
	return updateItems(monster, blockIndex, target, (items) => [
		...items,
		cloneValue(item),
	]);
}

/** Updates editable text while preserving every sibling on `{ entry, ...metadata }`. */
export function updateMonsterSpellcastingItemText(
	monster: MonsterData,
	blockIndex: number,
	target: MonsterSpellcastingItemTarget,
	itemIndex: number,
	text: string,
): MonsterData {
	const items = getStoredBlocks(monster);
	const block = items[blockIndex] || null;
	if (!block) return monster;
	const currentItems = getStoredItems(block, target);
	if (
		!Number.isInteger(itemIndex) ||
		itemIndex < 0 ||
		itemIndex >= currentItems.length
	) {
		return monster;
	}
	const current = currentItems[itemIndex];
	const next = isRecord(current) ? { ...current, entry: text } : text;
	if (
		(typeof current === "string" && current === text) ||
		(isRecord(current) && current.entry === text)
	) {
		return monster;
	}
	return updateItems(monster, blockIndex, target, (sourceItems) =>
		sourceItems.map((item, index) => (index === itemIndex ? next : item)),
	);
}

export function replaceMonsterSpellcastingItem(
	monster: MonsterData,
	blockIndex: number,
	target: MonsterSpellcastingItemTarget,
	itemIndex: number,
	item: unknown,
): MonsterData {
	const block = getStoredBlocks(monster)[blockIndex];
	if (!block) return monster;
	const currentItems = getStoredItems(block, target);
	if (
		!Number.isInteger(itemIndex) ||
		itemIndex < 0 ||
		itemIndex >= currentItems.length
	) {
		return monster;
	}
	return updateItems(monster, blockIndex, target, (items) =>
		items.map((current, index) =>
			index === itemIndex ? cloneValue(item) : current,
		),
	);
}

export function removeMonsterSpellcastingItem(
	monster: MonsterData,
	blockIndex: number,
	target: MonsterSpellcastingItemTarget,
	itemIndex: number,
): MonsterData {
	const block = getStoredBlocks(monster)[blockIndex];
	if (!block) return monster;
	const currentItems = getStoredItems(block, target);
	if (
		!Number.isInteger(itemIndex) ||
		itemIndex < 0 ||
		itemIndex >= currentItems.length
	) {
		return monster;
	}
	return updateItems(monster, blockIndex, target, (items) =>
		items.filter((_item, index) => index !== itemIndex),
	);
}

export function moveMonsterSpellcastingItem(
	monster: MonsterData,
	blockIndex: number,
	target: MonsterSpellcastingItemTarget,
	fromIndex: number,
	toIndex: number,
): MonsterData {
	const block = getStoredBlocks(monster)[blockIndex];
	if (!block) return monster;
	const items = getStoredItems(block, target);
	if (
		!Number.isInteger(fromIndex) ||
		!Number.isInteger(toIndex) ||
		fromIndex < 0 ||
		fromIndex >= items.length ||
		toIndex < 0 ||
		toIndex >= items.length ||
		fromIndex === toIndex
	) {
		return monster;
	}
	return updateItems(monster, blockIndex, target, (sourceItems) => {
		const next = sourceItems.slice();
		const [item] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, item);
		return next;
	});
}

export function addMonsterSpellcastingBucketGroup(
	monster: MonsterData,
	blockIndex: number,
	key: MonsterSpellcastingBucketKey,
	group: string,
): MonsterData {
	const normalizedGroup = normalizeMapKey(group);
	if (!normalizedGroup) return monster;
	return updateBlockAt(monster, blockIndex, (block) => {
		const groups = getRecordProperty(block, key);
		if (hasOwn(groups, normalizedGroup)) return block;
		return { ...block, [key]: { ...groups, [normalizedGroup]: [] } };
	});
}

export function renameMonsterSpellcastingBucketGroup(
	monster: MonsterData,
	blockIndex: number,
	key: MonsterSpellcastingBucketKey,
	currentGroup: string,
	nextGroup: string,
): MonsterData {
	const normalizedGroup = normalizeMapKey(nextGroup);
	if (!normalizedGroup || normalizedGroup === currentGroup) return monster;
	return updateBlockAt(monster, blockIndex, (block) => {
		const groups = getRecordProperty(block, key);
		if (!hasOwn(groups, currentGroup) || hasOwn(groups, normalizedGroup)) {
			return block;
		}
		return {
			...block,
			[key]: updateMapKey(groups, currentGroup, normalizedGroup),
		};
	});
}

export function removeMonsterSpellcastingBucketGroup(
	monster: MonsterData,
	blockIndex: number,
	key: MonsterSpellcastingBucketKey,
	group: string,
): MonsterData {
	return updateBlockAt(monster, blockIndex, (block) => {
		const groups = getRecordProperty(block, key);
		if (!hasOwn(groups, group)) return block;
		const nextGroups = { ...groups };
		delete nextGroups[group];
		return { ...block, [key]: nextGroups };
	});
}

export function addMonsterSpellcastingLevel(
	monster: MonsterData,
	blockIndex: number,
	level: string,
	metadata: MonsterSpellcastingLevelPatch = {},
): MonsterData {
	const normalizedLevel = normalizeMapKey(level);
	if (!normalizedLevel) return monster;
	return updateBlockAt(monster, blockIndex, (block) => {
		const levels = getStoredLevels(block);
		if (hasOwn(levels, normalizedLevel)) return block;
		const newLevel: MonsterSpellLevel = { spells: [] };
		if (metadata.slots !== undefined && metadata.slots !== null) {
			newLevel.slots = metadata.slots;
		}
		if (metadata.lower !== undefined && metadata.lower !== null) {
			newLevel.lower = metadata.lower;
		}
		return {
			...block,
			spells: { ...levels, [normalizedLevel]: newLevel },
		};
	});
}

export function renameMonsterSpellcastingLevel(
	monster: MonsterData,
	blockIndex: number,
	currentLevel: string,
	nextLevel: string,
): MonsterData {
	const normalizedLevel = normalizeMapKey(nextLevel);
	if (!normalizedLevel || normalizedLevel === currentLevel) return monster;
	return updateBlockAt(monster, blockIndex, (block) => {
		const levels = getStoredLevels(block);
		if (!hasOwn(levels, currentLevel) || hasOwn(levels, normalizedLevel)) {
			return block;
		}
		return {
			...block,
			spells: updateMapKey(levels, currentLevel, normalizedLevel),
		};
	});
}

export function updateMonsterSpellcastingLevel(
	monster: MonsterData,
	blockIndex: number,
	levelKey: string,
	patch: MonsterSpellcastingLevelPatch,
): MonsterData {
	return updateBlockAt(monster, blockIndex, (block) => {
		const levels = getStoredLevels(block);
		const storedLevel = levels[levelKey];
		if (!hasOwn(levels, levelKey) || !isRecord(storedLevel)) return block;
		const level = storedLevel;
		const nextLevel = { ...level };
		const writableLevel: Record<string, unknown> = nextLevel;
		let changed = false;
		for (const key of ["slots", "lower"] as const) {
			if (!hasOwn(patch, key)) continue;
			const value = patch[key];
			if (value === null || value === undefined) {
				if (hasOwn(nextLevel, key)) {
					delete writableLevel[key];
					changed = true;
				}
			} else if (!Object.is(nextLevel[key], value)) {
				writableLevel[key] = value;
				changed = true;
			}
		}
		if (!changed) return block;
		return {
			...block,
			spells: { ...levels, [levelKey]: nextLevel },
		};
	});
}

export function removeMonsterSpellcastingLevel(
	monster: MonsterData,
	blockIndex: number,
	levelKey: string,
): MonsterData {
	return updateBlockAt(monster, blockIndex, (block) => {
		const levels = getStoredLevels(block);
		if (!hasOwn(levels, levelKey)) return block;
		const nextLevels = { ...levels };
		delete nextLevels[levelKey];
		return { ...block, spells: nextLevels };
	});
}
