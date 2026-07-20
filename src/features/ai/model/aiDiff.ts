import type { AiHistoryEntry, AiHistoryResource } from "../api/aiApi.ts";
import type {
	DiffLabels,
	DiffResource,
} from "./aiDiffContracts.ts";
import {
	expandCustomBestiaryDiffResource,
	expandSessionDiffResource,
} from "./aiDiffExpansion.ts";
import { createLineDiff } from "./aiLineDiff.ts";
import { getDiffResourceFieldSummary } from "./aiDiffSnapshot.ts";

const DEFAULT_DIFF_STATE_LABELS = {
	added: "Added",
	deleted: "Deleted",
	modified: "Modified",
} as const;

type DiffResourceState = keyof typeof DEFAULT_DIFF_STATE_LABELS;

const DIFF_RESOURCE_STATE_POLICIES: ReadonlyArray<{
	state: DiffResourceState;
	matches: (resource: AiHistoryResource) => boolean;
}> = [
	{
		state: "added",
		matches: (resource) =>
			resource.before === null && resource.after !== null,
	},
	{
		state: "deleted",
		matches: (resource) =>
			resource.before !== null && resource.after === null,
	},
];

export function getDiffResourceState(
	resource: AiHistoryResource,
	labels: DiffLabels = {},
): string {
	const state =
		DIFF_RESOURCE_STATE_POLICIES.find((policy) => policy.matches(resource))
			?.state || "modified";
	return labels[state] || DEFAULT_DIFF_STATE_LABELS[state];
}

export function buildDiffResources(
	entry: AiHistoryEntry | null | undefined,
	labels: DiffLabels = {},
): DiffResource[] {
	const resources = Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
	return resources
		.flatMap((resource) => expandSessionDiffResource(resource, labels))
		.flatMap((resource) => expandCustomBestiaryDiffResource(resource, labels))
		.map((resource) => ({
			...resource,
			fieldSummary: getDiffResourceFieldSummary(
				resource.before,
				resource.after,
			),
			lines: createLineDiff(resource.before, resource.after),
		}));
}

export type {
	DiffLabels,
	DiffLine,
	DiffLineType,
	DiffResource,
} from "./aiDiffContracts.ts";
