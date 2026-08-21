import type { BestiaryMonster } from "../../../../entities/bestiary/index.js";
import {
	MonsterAiActionModal,
	type MonsterAiAction,
} from "../../../../features/ai-edit-monster/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { isCustomBestiarySource } from "../../model/encounterPagePresentation.ts";
import type { EncounterViewParticipant } from "../../model/contracts.ts";

interface EncounterMonsterActionModalsProps {
	aiActionMonster: EncounterViewParticipant | null;
	fieldActionMonster: EncounterViewParticipant | null;
	onAiCancel(): void;
	onAiChoose(action: MonsterAiAction): void;
	onFieldCancel(): void;
	onFieldChoose(action: MonsterAiAction): void;
}

export default function EncounterMonsterActionModals({
	aiActionMonster,
	fieldActionMonster,
	onAiCancel,
	onAiChoose,
	onFieldCancel,
	onFieldChoose,
}: EncounterMonsterActionModalsProps) {
	return (
		<>
			<MonsterAiActionModal
				aiActionMonster={aiActionMonster as BestiaryMonster | null}
				showLocalEdit={true}
				showGlobalEdit={isCustomBestiarySource(aiActionMonster?.source)}
				targetLabel={lang.t("Encounter creature")}
				onCancel={onAiCancel}
				onChoose={onAiChoose}
			/>
			<MonsterAiActionModal
				aiActionMonster={fieldActionMonster as BestiaryMonster | null}
				showLocalEdit={true}
				showGlobalEdit={isCustomBestiarySource(fieldActionMonster?.source)}
				targetLabel={lang.t("Encounter creature")}
				title={lang.t("Edit creature")}
				actionIcon="edit"
				onCancel={onFieldCancel}
				onChoose={onFieldChoose}
			/>
		</>
	);
}
