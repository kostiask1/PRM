import {
	BestiaryBrowser as Bestiary,
	type BestiaryBrowserProps,
} from "../../../../widgets/bestiary-browser/index.js";
import { createAiResponseModalComponent } from "../../../../widgets/ai-response-modal/index.js";
import { AiAssistantPanel } from "../../../../widgets/ai-assistant/index.js";
import { createMonsterEditorModalComponent } from "../../../../widgets/monster-editor-modal/index.js";
import { MonsterStatBlock } from "../../../../widgets/monster-stat-block/index.js";
import { SpellsBrowser } from "../../../../widgets/spells-browser/index.js";
import { createRulesReferenceModalContentComponent } from "../../../../widgets/rules-reference-modal/index.js";
import {
	CharacterCard,
	LocationCard,
} from "../../../../widgets/campaign-entity-card/index.js";
import EncounterBestiaryAiModals from "./EncounterBestiaryAiModals.tsx";

const EncounterRulesReferenceContent =
	createRulesReferenceModalContentComponent({
		BestiaryBrowser: EncounterBestiary,
		MonsterStatBlock,
		SpellsBrowser,
	});

const EncounterMonsterEditorModal = createMonsterEditorModalComponent({
	RulesReferenceContent: EncounterRulesReferenceContent,
});

const EncounterAiResponseModal = createAiResponseModalComponent({
	CharacterCard,
	LocationCard,
	MonsterStatBlock,
	MonsterEditorModal: EncounterMonsterEditorModal,
});

type EncounterBestiaryProps = Omit<
	BestiaryBrowserProps,
	| "BestiaryAiModals"
	| "AiAssistantPanel"
	| "MonsterStatBlock"
	| "ResponseModal"
	| "MonsterEditorModal"
>;

export function EncounterBestiary(props: EncounterBestiaryProps) {
	return (
		<Bestiary
			{...props}
			BestiaryAiModals={EncounterBestiaryAiModals}
			AiAssistantPanel={AiAssistantPanel}
			MonsterStatBlock={MonsterStatBlock}
			ResponseModal={EncounterAiResponseModal}
			MonsterEditorModal={EncounterMonsterEditorModal}
		/>
	);
}

export { EncounterAiResponseModal, EncounterMonsterEditorModal };
