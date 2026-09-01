import type { ReactElement, ReactNode } from "react";

import type {
	RichContentRenderOptions,
	RulesReferenceType,
} from "../model/richContentPresentation.ts";

export interface RichContentRollDiceSlotProps {
	formula: string;
	children?: ReactNode;
	context?: unknown;
}

export type RichContentRollDiceSlot = (
	props: RichContentRollDiceSlotProps,
) => ReactElement | null;

export interface RichContentRulesLinkSlotProps {
	children?: ReactNode;
	name?: string;
	type?: RulesReferenceType;
}

export type RichContentRulesLinkSlot = (
	props: RichContentRulesLinkSlotProps,
) => ReactElement | null;

export interface RichContentCompositionSlots {
	RollDice: RichContentRollDiceSlot;
	RulesLink: RichContentRulesLinkSlot;
}

export type ParseRollsAndSpells = (
	text: unknown,
	highlightQuery?: string,
	options?: RichContentRenderOptions,
) => ReactNode;

export type RenderRecursiveContent = (
	content: unknown,
	highlightQuery?: string,
	options?: RichContentRenderOptions,
) => ReactNode;

export interface RichContentRenderers {
	parseRollsAndSpells: ParseRollsAndSpells;
	renderRecursiveContent: RenderRecursiveContent;
}
