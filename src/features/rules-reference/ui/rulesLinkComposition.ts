import type { ReactElement, ReactNode } from "react";

import type { RulesReferenceType } from "../model.js";

export interface RulesLinkProps {
	children?: ReactNode;
	name?: string;
	type?: RulesReferenceType;
}

export interface RulesLinkRollDiceSlotProps {
	formula: string;
	children?: ReactNode;
	context?: unknown;
}

export type RulesLinkRollDiceSlot = (
	props: RulesLinkRollDiceSlotProps,
) => ReactElement | null;

export interface RulesLinkCompositionSlots {
	RollDice: RulesLinkRollDiceSlot;
}

export type RulesLinkComponent = (
	props: RulesLinkProps,
) => ReactElement | null;
