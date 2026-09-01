import type {
	BestiaryMonster,
	LegendaryGroup,
} from "../../../entities/bestiary/index.js";
import {
	normalizeMonsterName,
	normalizeMonsterSource,
} from "./bestiaryBrowserFiltering.ts";

interface LegendaryGroupReference {
	name: string;
	source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getLegendaryGroupIdentity(
	group: LegendaryGroup,
): LegendaryGroupReference {
	return {
		name: typeof group.name === "string" ? group.name : "",
		source: typeof group.source === "string" ? group.source : "",
	};
}

function getMonsterLegendaryGroup(
	monster: BestiaryMonster,
): Record<string, unknown> | null {
	return isRecord(monster.legendaryGroup) ? monster.legendaryGroup : null;
}

function getMonsterLegendaryName(
	monster: BestiaryMonster,
	reference: Record<string, unknown> | null,
): string {
	return typeof reference?.name === "string" ? reference.name : monster.name;
}

function getMonsterLegendarySource(
	monster: BestiaryMonster,
	reference: Record<string, unknown> | null,
): string {
	return typeof reference?.source === "string"
		? reference.source
		: String(monster.source ?? "");
}

function getMonsterLegendaryReference(
	monster: BestiaryMonster,
): LegendaryGroupReference {
	const reference = getMonsterLegendaryGroup(monster);
	return {
		name: getMonsterLegendaryName(monster, reference),
		source: getMonsterLegendarySource(monster, reference),
	};
}

export function enrichMonstersWithLegendaryGroups(
	monsters: BestiaryMonster[],
	legendaryGroups: LegendaryGroup[],
): BestiaryMonster[] {
	const groupsByIdentity = new Map(
		legendaryGroups.map((group) => {
			const identity = getLegendaryGroupIdentity(group);
			return [
				`${normalizeMonsterName(identity.name)}|${normalizeMonsterSource(identity.source)}`,
				group,
			];
		}),
	);
	return monsters.map((monster) => {
		const identity = getMonsterLegendaryReference(monster);
		const group = groupsByIdentity.get(
			`${normalizeMonsterName(identity.name)}|${normalizeMonsterSource(identity.source)}`,
		);
		if (!group) return monster;
		return {
			...monster,
			lairActions: group.lairActions,
			regionalEffects: group.regionalEffects,
		};
	});
}
