import type { MouseEvent, ReactNode } from "react";
import "../../../assets/components/RollDice.css";
import { lang } from "../../../shared/lib/index.js";
import { Tooltip } from "../../../shared/ui/index.js";
import { createRollDicePayload } from "../model.ts";
import { useDiceRequestRuntime } from "./DiceRuntime.tsx";

export interface RollDiceProps {
	formula: string;
	children?: ReactNode;
	context?: unknown;
}

export default function RollDice({
	formula,
	children,
	context = null,
}: RollDiceProps) {
	const { requestRoll } = useDiceRequestRuntime();
	const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
		event.preventDefault();
		event.stopPropagation();
		requestRoll(createRollDicePayload(formula, context));
	};

	return (
		<Tooltip content={lang.t("Roll {formula}", { formula })}>
			<span className="RollDice" onClick={handleClick}>
				{children || formula}
			</span>
		</Tooltip>
	);
}
