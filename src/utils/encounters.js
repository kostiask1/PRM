export function createEncounterMonsterInstance(monster) {
	const hpVal =
		typeof monster.hp === "object" && monster.hp?.average !== undefined
			? monster.hp.average
			: monster.hit_points || 0;

	let acVal = monster.armor_class || 0;
	if (Array.isArray(monster.ac) && monster.ac[0]) {
		const entry = monster.ac[0];
		acVal = typeof entry === "object" ? entry.ac : entry;
	}

	return {
		...monster,
		instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		originalBestiaryName: monster.name,
		currentHp: hpVal,
		hit_points: hpVal,
		armor_class: acVal,
	};
}
