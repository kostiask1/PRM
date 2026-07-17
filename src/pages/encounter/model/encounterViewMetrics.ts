import type {
	EncounterViewParticipant,
	InitiativeStats,
} from "./contracts.ts";

export function parseChallengeRating(
	monster: EncounterViewParticipant,
): number {
	const crRecord =
		monster.cr && typeof monster.cr === "object"
			? (monster.cr as { cr?: unknown })
			: null;
	const crValue = crRecord?.cr !== undefined ? crRecord.cr : monster.cr;
	if (typeof crValue === "number") return crValue;

	const crText = String(crValue || "0").trim();
	if (crText.includes("/")) {
		const [numerator, denominator] = crText.split("/").map(Number);
		return denominator ? numerator / denominator : 0;
	}

	return Number.parseFloat(crText) || 0;
}

export function getExpectedInitiative(
	monster: EncounterViewParticipant,
): number {
	const dexterity = monster.dex ?? monster.dexterity ?? 10;
	const modifier = Math.floor((Number(dexterity) - 10) / 2);
	return 10.5 + modifier;
}

function formatInitiativeValue(value: number): number | string {
	if (!Number.isFinite(value)) return 0;
	return value % 1 === 0 ? value : value.toFixed(1);
}

export function calculateInitiativeStats(
	monsters: EncounterViewParticipant[] = [],
): InitiativeStats {
	if (monsters.length === 0) {
		return { average: 0, max: 0, weightedAverage: 0 };
	}

	let total = 0;
	let maximum = -Infinity;
	let weightedTotal = 0;
	let totalWeight = 0;

	for (const monster of monsters) {
		const initiative = getExpectedInitiative(monster);
		const weight = Math.max(0, parseChallengeRating(monster)) + 1;
		total += initiative;
		maximum = Math.max(maximum, initiative);
		weightedTotal += initiative * weight;
		totalWeight += weight;
	}

	return {
		average: formatInitiativeValue(total / monsters.length),
		max: formatInitiativeValue(maximum),
		weightedAverage: formatInitiativeValue(weightedTotal / totalWeight),
	};
}
