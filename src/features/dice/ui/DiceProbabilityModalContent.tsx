import { useMemo } from "react";
import {
	getDiceProbabilityDistribution,
	lang,
} from "../../../shared/lib/index.js";
import {
	formatDiceProbability,
	getDiceProbabilityBarWidth,
} from "../model.ts";

export interface DiceProbabilityModalContentProps {
	formula: string;
}

export default function DiceProbabilityModalContent({
	formula,
}: DiceProbabilityModalContentProps) {
	const distribution = useMemo(
		() =>
			getDiceProbabilityDistribution(formula, {
				maxRollCombinations: 200000,
				maxStates: 20000,
			}),
		[formula],
	);

	if (!distribution) {
		return (
			<div className="DiceCalculator__probabilityEmpty">
				{lang.t("Probability graph is unavailable for this formula.")}
			</div>
		);
	}

	return (
		<div className="DiceCalculator__probability">
			<div className="DiceCalculator__probabilitySummary">
				<div>
					<span>{lang.t("Formula")}</span>
					<strong>{distribution.formula}</strong>
				</div>
				<div>
					<span>{lang.t("Min")}</span>
					<strong>{distribution.min}</strong>
				</div>
				<div>
					<span>{lang.t("Avg")}</span>
					<strong>{distribution.average.toFixed(2)}</strong>
				</div>
				<div>
					<span>{lang.t("Max")}</span>
					<strong>{distribution.max}</strong>
				</div>
			</div>

			<div className="DiceCalculator__probabilityChart">
				{distribution.outcomes.map((outcome) => {
					const width = getDiceProbabilityBarWidth(
						outcome.probability,
						distribution.maxProbability,
					);
					return (
						<div
							className="DiceCalculator__probabilityRow"
							key={outcome.value}
						>
							<div className="DiceCalculator__probabilityValue">
								{outcome.value}
							</div>
							<div
								className="DiceCalculator__probabilityTrack"
								aria-label={`${outcome.value}: ${formatDiceProbability(
									outcome.probability,
								)}`}
							>
								<div
									className="DiceCalculator__probabilityBar"
									style={{ width: `${width}%` }}
								/>
							</div>
							<div className="DiceCalculator__probabilityPercent">
								{formatDiceProbability(outcome.probability)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
