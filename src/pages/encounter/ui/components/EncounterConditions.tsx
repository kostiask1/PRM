import { lang } from "../../../../shared/lib/index.js";
import { RollDice } from "../../../../features/dice/index.js";
import { createRulesLinkComponent } from "../../../../features/rules-reference/index.js";
import type { EncounterViewModel, EncounterViewParticipant } from "../../model/contracts.ts";

const ConditionPreview = createRulesLinkComponent({ RollDice });

function formatConditionLabel(condition: string): string {
	const [name, source] = condition.split("|");
	if (!source) return name || "";
	return `${name} (${source})`;
}

export default function EncounterConditions({ monster, instanceId, view, onAdd }: {
	monster: EncounterViewParticipant;
	instanceId: string;
	view: Pick<EncounterViewModel, "updateMonsterConditions">;
	onAdd: (instanceId: string) => void;
}) {
	const conditions = Array.isArray(monster.encounterConditions)
		? monster.encounterConditions.filter((condition): condition is string => typeof condition === "string" && Boolean(condition.trim()))
		: [];
	return (
		<div className="EncounterMonsterRow__conditions" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
			{conditions.map((condition, index) => {
				const label = formatConditionLabel(condition);
				return (
					<ConditionPreview type="condition" name={condition} previewOnly key={`${condition}-${index}`}>
						<span className="EncounterMonsterRow__condition">
							<span>{label}</span>
							<button type="button" aria-label={lang.t("Remove condition: {condition}", { condition: label })} onClick={() => view.updateMonsterConditions(instanceId, conditions.filter((_, itemIndex) => itemIndex !== index))}>×</button>
						</span>
					</ConditionPreview>
				);
			})}
			<button type="button" className="EncounterMonsterRow__addCondition" onClick={() => onAdd(instanceId)}>+ {lang.t("Add condition")}</button>
		</div>
	);
}

