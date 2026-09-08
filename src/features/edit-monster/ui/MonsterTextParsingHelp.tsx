import type { ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";

interface MonsterTextParsingHelpProps {
	id: string;
}

interface SyntaxHelpRow {
	syntax: readonly string[];
	description: string;
	note?: string;
}

const COMPLETE_DAMAGE_EXAMPLE =
	"{@h}9 ({@damage 2d6 + 2}) bludgeoning damage plus 7 ({@damage 2d6}) necrotic damage";

const COMPLETE_DAMAGE_RESULT =
	"Hit: 9 (2d6 + 2) bludgeoning damage plus 7 (2d6) necrotic damage";

const ROLL_ROWS: readonly SyntaxHelpRow[] = [
	{
		syntax: ["2d6", "2d6 + 3", "2d6 - 1"],
		description:
			"A bare NdM expression becomes a clickable roll. Automatic detection reliably captures at most one numeric modifier; use a dice or damage tag for compound formulas.",
	},
	{
		syntax: ["+9 to hit", "-2"],
		description:
			"A standalone signed number also becomes a d20 roll with that modifier. This applies anywhere in rich text; write 'plus 9' or 'minus 2' when a signed value must stay plain.",
	},
	{
		syntax: ["{@hit 9}", "{@hit +9}"],
		description:
			"Shows +9 and rolls 1d20+9. A literal English ' to hit' immediately after the tag is included in the clickable label.",
	},
	{
		syntax: [
			"{@dice 2d6 + 3}",
			"{@dice 5d6h3|Best three dice}",
		],
		description:
			"Rolls the first pipe segment and shows the optional second segment as its label. Dice formulas support NdM, +, -, multiplication, parentheses, hN, and lN; division is not supported.",
	},
	{
		syntax: [
			"{@damage 2d6 + 2}",
			"{@scaledamage 2d6 + 2}",
			"{@scaledice 2d6 + 2}",
		],
		description:
			"Makes the fixed dice prefix clickable. A damage formula must start with NdM and may continue with any number of + or - dice or numeric terms. Scaledamage and scaledice currently use the same renderer; they do not calculate scaling.",
	},
	{
		syntax: [
			"{@damage 2d6 + 2|unused|Fire damage}",
			"{@damage (summonSpellLevel - 3)d12 + 3|2d12 + 3}",
		],
		description:
			"Damage pipes mean primary|fallback|label. With a fixed primary roll, the third segment is the visible label. If primary is dynamic, a fixed second segment becomes both the fallback roll and label; no scaling is calculated.",
		note:
			"In an unrollable damage remainder, exact summonSpellLevel and PB text is displayed as 'spell level' and 'proficiency bonus'.",
	},
	{
		syntax: [
			"{@recharge}",
			"{@recharge 5}",
			"{@recharge 4-6}",
			"(Recharge 5-6)",
		],
		description:
			"Creates a clickable 1d6 recharge check. No number or 6 means Recharge 6; a single 5 means Recharge 5-6; an explicit range is preserved.",
	},
];

const COMBAT_TEXT_ROWS: readonly SyntaxHelpRow[] = [
	{
		syntax: ["{@h}", "{@dc 15}"],
		description:
			"Expands to 'Hit: ' and 'DC 15'. The h tag is text only; use a hit tag when the attack bonus must be rollable. DC accepts digits only.",
	},
	{
		syntax: [
			"{@atk mw}",
			"{@atk rw}",
			"{@atk mw,rw}",
			"{@atk ms}",
			"{@atk rs}",
			"{@atk ms,rs}",
		],
		description:
			"Expands respectively to Melee, Ranged, or Melee or Ranged Weapon Attack, then the same three Spell Attack variants.",
	},
	{
		syntax: [
			"{@atkr m}",
			"{@atkr r}",
			"{@atkr m,r}",
			"{@atkr ms}",
			"{@atkr rs}",
			"{@atkr ms,rs}",
		],
		description:
			"Expands to the corresponding Melee, Ranged, combined, or Spell Attack label. Use lowercase codes. The shorter atk tag does not support m or m,r; use atkr for those codes.",
	},
	{
		syntax: [
			"{@hitYourSpellAttack}",
			"{@hitYourSpellAttack custom label}",
		],
		description:
			"Shows 'your spell attack bonus', or the custom label supplied after the tag name. It does not create a roll because no numeric modifier is known.",
	},
	{
		syntax: [
			"{@actSaveFail}",
			"{@actSaveFail 5}",
			"{@actSaveSuccess}",
			"{@actSaveSuccessOrFail}",
		],
		description:
			"Expands to the standard English phrases 'On a failure,', 'On a failure by 5 or more,', 'On a success,', and 'On a success or failure,'.",
	},
	{
		syntax: [
			"{@ability str}",
			"{@savingThrow dex}",
			"{@actSave wis}",
		],
		description:
			"Expands an ability name or an ability saving-throw phrase. Supported lowercase codes are str, dex, con, int, wis, and cha.",
	},
	{
		syntax: ["{@chance 25}", "{@chance 50|50 percent|ignored}"],
		description:
			"Shows 25%, or the optional second pipe segment. Further chance segments are ignored.",
	},
];

const REFERENCE_ROWS: readonly SyntaxHelpRow[] = [
	{
		syntax: [
			"{@spell Fireball|PHB|Flame Burst}",
			"{@spell Fireball||Flame Burst}",
		],
		description:
			"Creates a spell link. Lookup uses the first segment; the third segment is the visible label. The stored source segment is accepted, but this renderer currently resolves spells by name.",
	},
	{
		syntax: ["{@creature Goblin|MM|Goblin scout}"],
		description:
			"Creates a creature link. The second segment disambiguates the source; when it is empty, the current creature source is used. The third segment is the visible label.",
	},
	{
		syntax: [
			"{@condition Poisoned}",
			"{@status Concentration}",
		],
		description:
			"Creates a condition or status link. Both open the Conditions reference. A third display-label segment is currently ignored for these two tags.",
	},
	{
		syntax: [
			"{@disease Sight Rot}",
			"{@variantrule Flanking|DMG}",
			"{@skill Arcana}",
			"{@sense Darkvision}",
		],
		description:
			"Creates a link to the matching disease, variant rule, skill, or sense. Lookup uses the first segment; an optional third segment supplies the visible label.",
	},
	{
		syntax: [
			"{@quickref Cover||3||Total cover}",
			"{@quickref difficult terrain||3}",
		],
		description:
			"Creates a Variant Rules link. The last nonempty, nonnumeric segment after the first becomes both its lookup text and label; otherwise the first segment is used.",
	},
	{
		syntax: ["@condition Poisoned"],
		description:
			"Legacy unbraced condition syntax is recognized only for ASCII letters, apostrophes, spaces, and hyphens, and its match is greedy. Prefer the braced condition tag.",
	},
];

const DISPLAY_ROWS: readonly SyntaxHelpRow[] = [
	{
		syntax: [
			"{@i italic text}",
			"{@italic italic text}",
			"{@b bold text}",
			"{@bold bold text}",
		],
		description:
			"Converts to inline Markdown emphasis or bold text. Do not nest tags; parsing stops at the first closing brace.",
	},
	{
		syntax: ["{@note visible text}", "{@filter Light|items|type=Light Armor}"],
		description:
			"The note wrapper is removed but its text remains. Filter shows only its first name segment.",
	},
	{
		syntax: [
			"{@action name|source|label}",
			"{@link name|source|label}",
			"{@item name|source|label}",
			"{@book name|source|label}",
			"{@area name|source|label}",
			"{@hazard name|source|label}",
			"{@trap name|source|label}",
			"{@deck name|source|label}",
			"{@optfeature name|source|label}",
			"{@reward name|source|label}",
			"{@feat name|source|label}",
			"{@charoption name|source|label}",
			"{@background name|source|label}",
			"{@race name|source|label}",
		],
		description:
			"These are display-only tags, not links. They show the third segment when it is nonempty, otherwise the first. Content after the third pipe segment is ignored.",
	},
	{
		syntax: ["{@hom}", "{@loader internal data}"],
		description:
			"These tags and their wrappers are removed completely from displayed text.",
	},
];

const UNSUPPORTED_TAGS = [
	"{@actTrigger ...}",
	"{@actResponse ...}",
	"{@adventure ...}",
	"{@skillCheck ...}",
	"{@table ...}",
	"{@dcYourSpellSave}",
	"{@footnote ...}",
	"{@actSaveFailBy ...}",
	"{@atk m}",
	"{@atk m,r}",
] as const;

const RICH_JSON_EXAMPLES = [
	`{
  "type": "list",
  "items": [
    "Plain text",
    { "name": "Named item", "entry": "Item text" },
    { "name": "Named item", "entries": ["Item text"] }
  ]
}`,
	`{
  "type": "entries",
  "name": "Section name",
  "entries": ["Section text"]
}`,
	`{
  "type": "table",
  "caption": "Table name",
  "colLabels": ["d6", "Effect"],
  "colStyles": ["col-2", "col-10"],
  "rows": [["1", "Effect text"]]
}`,
] as const;

const SPELLCASTING_JSON_EXAMPLE = `{
  "spellcasting": [
    {
      "name": "Spellcasting",
      "headerEntries": ["Introductory text"],
      "will": ["{@spell Light|XPHB}"],
      "daily": { "1": ["{@spell Fireball|XPHB}"] },
      "spells": {
        "0": { "spells": ["{@spell Mage Hand|XPHB}"] },
        "3": { "slots": 2, "spells": ["{@spell Fireball|XPHB}"] }
      },
      "footerEntries": ["Closing text"]
    }
  ]
}`;

function SyntaxList({ values }: { values: readonly string[] }) {
	return (
		<div className="MonsterFieldEditModal__help_syntaxes">
			{values.map((value) => (
				<code key={value}>{value}</code>
			))}
		</div>
	);
}

function SyntaxRows({ rows }: { rows: readonly SyntaxHelpRow[] }) {
	return (
		<dl className="MonsterFieldEditModal__help_rows">
			{rows.map((row) => (
				<div className="MonsterFieldEditModal__help_row" key={row.syntax.join("|")}>
					<dt>
						<SyntaxList values={row.syntax} />
					</dt>
					<dd>
						<p>{lang.t(row.description)}</p>
						{row.note && (
							<p className="MonsterFieldEditModal__help_note">
								{lang.t(row.note)}
							</p>
						)}
					</dd>
				</div>
			))}
		</dl>
	);
}

function HelpSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="MonsterFieldEditModal__help_section">
			<h5>{lang.t(title)}</h5>
			{children}
		</section>
	);
}

function CodeBlock({ children }: { children: string }) {
	return (
		<pre className="MonsterFieldEditModal__help_code_block">
			<code>{children}</code>
		</pre>
	);
}

export default function MonsterTextParsingHelp({
	id,
}: MonsterTextParsingHelpProps) {
	return (
		<article
			id={id}
			className="MonsterFieldEditModal__help"
			aria-labelledby={`${id}-title`}
		>
			<header className="MonsterFieldEditModal__help_intro">
				<h4 id={`${id}-title`}>{lang.t("Creature text parsing reference")}</h4>
				<p>
					{lang.t(
						"Rich parsing is used in displayed AC and HP values; string-valued creature descriptions; action names and bodies; senses; lair and regional content; structured spellcasting; and nested rich JSON entries.",
					)}
				</p>
				<p>
					{lang.t(
						"In action names, references and text substitutions still work, but non-recharge rolls are displayed as plain text.",
					)}
				</p>
				<p>
					{lang.t(
						"Speed, languages, challenge rating, vulnerabilities, resistances, damage immunities, and condition immunities are displayed as plain field values. Tags entered there remain visible literally.",
					)}
				</p>
				<p>
					{lang.t(
						"Press Ctrl+K or Cmd+K in Armor Class, Senses, Description, or an action name or body (Ctrl+Л on a Ukrainian keyboard) to open the parser action chooser. It can build rolls, combat notation, and formatting, or open the spell and rules browsers. A selected text range is used as the initial value and replaced after insertion.",
					)}
				</p>
				<p>
					{lang.t(
						"Tags are case-insensitive, but ability and atkr codes should be lowercase. Tags cannot be nested, pipes cannot be escaped, and unknown or malformed tags are displayed literally.",
					)}
				</p>
			</header>

			<HelpSection title="Complete attack-and-damage example">
				<div className="MonsterFieldEditModal__help_example">
					<strong>{lang.t("Source text")}</strong>
					<CodeBlock>{COMPLETE_DAMAGE_EXAMPLE}</CodeBlock>
					<strong>{lang.t("Displayed on the creature card")}</strong>
					<CodeBlock>{COMPLETE_DAMAGE_RESULT}</CodeBlock>
					<p>
						{lang.t(
							"The values 9 and 7 remain ordinary average-damage text. Each formula inside a damage tag becomes a clickable roll; the h tag only adds 'Hit: '.",
						)}
					</p>
				</div>
			</HelpSection>

			<HelpSection title="Clickable rolls">
				<SyntaxRows rows={ROLL_ROWS} />
			</HelpSection>

			<HelpSection title="Rule-reference links">
				<p>
					{lang.t("General form:")} <code>{"{@type name|source|label}"}</code>.{" "}
					{lang.t(
						"Source and label are optional; use an empty source segment when only a label is needed: name||label. Link labels are capitalized word by word.",
					)}
				</p>
				<SyntaxRows rows={REFERENCE_ROWS} />
				<p className="MonsterFieldEditModal__help_note">
					{lang.t(
						"In Senses, the bare English names blindsight, darkvision, tremorsense, and truesight also become links automatically.",
					)}
				</p>
			</HelpSection>

			<HelpSection title="Combat-text substitutions">
				<SyntaxRows rows={COMBAT_TEXT_ROWS} />
			</HelpSection>

			<HelpSection title="Formatting and display-only tags">
				<SyntaxRows rows={DISPLAY_ROWS} />
				<p className="MonsterFieldEditModal__help_note">
					{lang.t(
						"Ordinary inline Markdown is rendered too, but list markers at the start of a text line are escaped. Use a rich JSON list object for a real list.",
					)}
				</p>
			</HelpSection>

			<HelpSection title="Unsupported tags and parser limits">
				<p>
					{lang.t(
						"Unsupported tags remain visible as source text. Common unsupported 5etools forms currently found in Bestiary data include:",
					)}
				</p>
				<SyntaxList values={UNSUPPORTED_TAGS} />
				<p className="MonsterFieldEditModal__help_note">
					{lang.t(
						"The English note suffix '(see the “...” in notes).' is removed before rendering. Four-part display-only tags can show their third segment instead of a later human label.",
					)}
				</p>
			</HelpSection>

			<HelpSection title="Rich content in JSON mode">
				<p>
					{lang.t(
						"Strings and numbers are rendered directly, while arrays are rendered recursively without automatic separators. The same inline parser runs inside supported nested strings.",
					)}
				</p>
				<div className="MonsterFieldEditModal__help_code_grid">
					{RICH_JSON_EXAMPLES.map((example) => (
						<CodeBlock key={example}>{example}</CodeBlock>
					))}
				</div>
				<ul>
					<li>
						{lang.t(
							"type: 'section' behaves like type: 'entries'. An object with entry renders only that property.",
						)}
					</li>
					<li>
						{lang.t(
							"type: 'image' is hidden. An unknown object is displayed as JSON text.",
						)}
					</li>
					<li>
						{lang.t(
							"Editing an action's rich entries in Fields mode converts that edited body to one plain text entry. Use JSON mode to create or retain lists, sections, and tables.",
						)}
					</li>
				</ul>
			</HelpSection>

			<HelpSection title="Structured spellcasting in JSON mode">
				<CodeBlock>{SPELLCASTING_JSON_EXAMPLE}</CodeBlock>
				<p>
					{lang.t(
						"Only name, headerEntries, will, daily, spells, and footerEntries are read from each spellcasting block. Their values use rich parsing, so spell names should use spell tags.",
					)}
				</p>
				<p className="MonsterFieldEditModal__help_note">
					{lang.t(
						"Legacy spell_list is separate: it accepts spell URLs or slugs, loads matching spells, and groups them by level.",
					)}
				</p>
			</HelpSection>
		</article>
	);
}
