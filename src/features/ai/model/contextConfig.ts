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

export function ensureContextListItems<T>(
	currentValue: unknown,
	list: readonly T[],
	getKey: (item: T) => string,
): ContextListConfig {
	const current = getContextListConfig(currentValue);
	const nextItems = { ...current.items };
	let changed =
		!currentValue ||
		typeof currentValue !== "object" ||
		Array.isArray(currentValue) ||
		!(currentValue as Record<string, unknown>).items;

	for (const item of list) {
		const key = getKey(item);
		if (!key || Object.prototype.hasOwnProperty.call(nextItems, key)) continue;
		nextItems[key] = true;
		changed = true;
	}

	if (!changed) return currentValue as ContextListConfig;
	return { included: current.included, items: nextItems };
}

export function updateContextConfigValue(
	config: AiContextConfiguration | null | undefined,
	path: string[],
	value: unknown,
): AiContextConfiguration | null | undefined {
	if (!Array.isArray(path) || path.length === 0) return config;
	const next = JSON.parse(
		JSON.stringify(config || {}),
	) as AiContextConfiguration;
	let current: AiContextConfiguration = next;
	for (let index = 0; index < path.length - 1; index += 1) {
		const key = path[index];
		if (!isRecord(current[key])) {
			current[key] =
				path[index - 1] === "scenes" ? { ...DEFAULT_SCENE_CONTEXT } : {};
		}
		current = current[key] as AiContextConfiguration;
	}
	current[path[path.length - 1]] = value;
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
