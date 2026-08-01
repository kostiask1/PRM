import { RollDice } from "../../../features/dice/index.js";
import { createRichContentRenderers } from "../../../features/rich-content/index.js";
import { createRulesLinkComponent } from "../../../features/rules-reference/index.js";

export const MonsterStatBlockRulesLink = createRulesLinkComponent({ RollDice });

const monsterStatBlockRichContent = createRichContentRenderers({
	RollDice,
	RulesLink: MonsterStatBlockRulesLink,
});

export const parseMonsterStatBlockRollsAndSpells =
	monsterStatBlockRichContent.parseRollsAndSpells;
export const renderMonsterStatBlockContent =
	monsterStatBlockRichContent.renderRecursiveContent;
