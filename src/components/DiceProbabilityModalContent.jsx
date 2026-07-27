import { useMemo } from "react";
import { getDiceProbabilityDistribution } from "../utils/dice";
import { lang } from "../services/localization";

function formatProbability(value) {
	const percent = value * 100;
	if (percent > 0 && percent < 0.001) return "<0.001%";
	if (percent >= 10) return `${percent.toFixed(1)}%`;
	if (percent >= 1) return `${percent.toFixed(2)}%`;
	return `${percent.toFixed(3)}%`;
}

export default function DiceProbabilityModalContent({ formula }) {
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
					const width =
						distribution.maxProbability > 0
							? (outcome.probability / distribution.maxProbability) * 100
							: 0;
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
								aria-label={`${outcome.value}: ${formatProbability(
									outcome.probability,
								)}`}
							>
								<div
									className="DiceCalculator__probabilityBar"
									style={{ width: `${width}%` }}
								/>
							</div>
							<div className="DiceCalculator__probabilityPercent">
								{formatProbability(outcome.probability)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
