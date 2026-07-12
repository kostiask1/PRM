const DEFAULT_SCENE_CONTEXT = Object.freeze({
	included: true,
	summary: true,
	goal: true,
	stakes: true,
	location: true,
	notes: true,
	encounter: true,
});

export function getContextListConfig(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return {
			included: value.included !== false,
			items: value.items && typeof value.items === "object" ? value.items : {},
		};
	}
	return { included: value !== false, items: {} };
}

export function ensureContextListItems(currentValue, list, getKey) {
	const current = getContextListConfig(currentValue);
	const nextItems = { ...current.items };
	let changed =
		!currentValue ||
		typeof currentValue !== "object" ||
		Array.isArray(currentValue) ||
		!currentValue.items;

	for (const item of list) {
		const key = getKey(item);
		if (!key || Object.prototype.hasOwnProperty.call(nextItems, key)) continue;
		nextItems[key] = true;
		changed = true;
	}

	if (!changed) return currentValue;
	return { included: current.included, items: nextItems };
}

export function updateContextConfigValue(config, path, value) {
	if (!Array.isArray(path) || path.length === 0) return config;
	const next = JSON.parse(JSON.stringify(config || {}));
	let current = next;
	for (let index = 0; index < path.length - 1; index += 1) {
		const key = path[index];
		if (!current[key]) {
			current[key] =
				path[index - 1] === "scenes" ? { ...DEFAULT_SCENE_CONTEXT } : {};
		}
		current = current[key];
	}
	current[path[path.length - 1]] = value;
	return next;
}

export function updateContextListIncluded(config, contextKey, included) {
	const current = getContextListConfig(config?.[contextKey]);
	return {
		...(config || {}),
		[contextKey]: { ...current, included },
	};
}

export function updateContextListItem(config, contextKey, itemKey, value) {
	const current = getContextListConfig(config?.[contextKey]);
	return {
		...(config || {}),
		[contextKey]: {
			...current,
			items: { ...current.items, [itemKey]: value },
		},
	};
}

export function setAllContextListItems(
	config,
	contextKey,
	list,
	getKey,
	checked,
) {
	const items = Object.fromEntries(
		list
			.map((item) => getKey(item))
			.filter(Boolean)
			.map((key) => [key, checked]),
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
