const DEFAULT_SCENE_CONTEXT = Object.freeze({
	included: true,
	summary: true,
	goal: true,
	stakes: true,
	location: true,
	notes: true,
	encounter: true,
});

export interface ContextListConfig {
	included: boolean;
	items: Record<string, boolean>;
}

export type AiContextConfiguration = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getContextListConfig(value: unknown): ContextListConfig {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		return {
			included: record.included !== false,
			items: isRecord(record.items)
				? (record.items as Record<string, boolean>)
				: {},
		};
	}
	return { included: value !== false, items: {} };
}

function isNormalizedContextListConfig(
	value: unknown,
): value is ContextListConfig {
	return (
		isRecord(value) &&
		typeof value.included === "boolean" &&
		isRecord(value.items)
	);
}

function addMissingContextListItems<T>(
	items: Record<string, boolean>,
	list: readonly T[],
	getKey: (item: T) => string,
): boolean {
	let changed = false;
	for (const item of list) {
		const key = getKey(item);
		if (!key || Object.prototype.hasOwnProperty.call(items, key)) continue;
		items[key] = true;
		changed = true;
	}
	return changed;
}

export function ensureContextListItems<T>(
	currentValue: unknown,
	list: readonly T[],
	getKey: (item: T) => string,
): ContextListConfig {
	const current = getContextListConfig(currentValue);
	const nextItems = { ...current.items };
	const itemsChanged = addMissingContextListItems(nextItems, list, getKey);
	if (isNormalizedContextListConfig(currentValue) && !itemsChanged) {
		return currentValue;
	}
	return { included: current.included, items: nextItems };
}

function cloneContextConfiguration(
	config: AiContextConfiguration | null | undefined,
): AiContextConfiguration {
	return JSON.parse(JSON.stringify(config || {})) as AiContextConfiguration;
}

function createContextPathNode(parentKey: string | undefined) {
	return parentKey === "scenes" ? { ...DEFAULT_SCENE_CONTEXT } : {};
}

function getOrCreateContextPathNode(
	current: AiContextConfiguration,
	key: string,
	parentKey: string | undefined,
): AiContextConfiguration {
	if (!isRecord(current[key])) {
		current[key] = createContextPathNode(parentKey);
	}
	return current[key] as AiContextConfiguration;
}

function setNestedContextValue(
	config: AiContextConfiguration,
	path: string[],
	value: unknown,
): void {
	let current = config;
	for (let index = 0; index < path.length - 1; index += 1) {
		current = getOrCreateContextPathNode(
			current,
			path[index],
			path[index - 1],
		);
	}
	current[path[path.length - 1]] = value;
}

export function updateContextConfigValue(
	config: AiContextConfiguration | null | undefined,
	path: string[],
	value: unknown,
): AiContextConfiguration | null | undefined {
	if (!Array.isArray(path) || path.length === 0) return config;
	const next = cloneContextConfiguration(config);
	setNestedContextValue(next, path, value);
	return next;
}

export function updateContextListIncluded(
	config: AiContextConfiguration | null | undefined,
	contextKey: string,
	included: boolean,
): AiContextConfiguration {
	const current = getContextListConfig(config?.[contextKey]);
	return {
		...(config || {}),
		[contextKey]: { ...current, included },
	};
}

export function updateContextListItem(
	config: AiContextConfiguration | null | undefined,
	contextKey: string,
	itemKey: string,
	value: boolean,
): AiContextConfiguration {
	const current = getContextListConfig(config?.[contextKey]);
	return {
		...(config || {}),
		[contextKey]: {
			...current,
			items: { ...current.items, [itemKey]: value },
		},
	};
}

export function setAllContextListItems<T>(
	config: AiContextConfiguration | null | undefined,
	contextKey: string,
	list: readonly T[],
	getKey: (item: T) => string,
	checked: boolean,
): AiContextConfiguration {
	const items = Object.fromEntries(
		list
			.map((item: T) => getKey(item))
			.filter((key): key is string => Boolean(key))
			.map((key: string) => [key, checked]),
	);
	return {
		...(config || {}),
		[contextKey]: {
			...getContextListConfig(config?.[contextKey]),
			included: true,
			items,
		},
	};
}
