import React, { type DragEvent, type ReactNode } from "react";
import type {
	BestiaryMonster,
	MonsterEntry,
	MonsterStatBlockModel,
} from "../../../entities/bestiary/index.js";
import { capitalizeWords, formatModifier, getAbilityModifier, getDamageBonus } from "../../../entities/reference/index.js";
import { ClickToCopy } from "../../../features/clipboard/index.js";
import { RollDice } from "../../../features/dice/index.js";
import { ImageDropzone } from "../../../features/images/index.js";
import { RulesLink } from "../../../features/rules-reference/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import { Button, Icon, Tooltip } from "../../../shared/ui/index.js";
import type {
	LoadedMonsterSpell,
	MonsterSpellcastingEntry,
	MonsterTokenSources,
	SenseTextPart,
	SpellLevelGroup,
	TokenDragPayload,
} from "../model/monsterStatBlockPresentation.ts";

export interface RenderHelpers {
	highlight: (value: unknown) => ReactNode;
	renderContent: (value: unknown) => ReactNode;
	renderActionName: (value: unknown) => ReactNode;
	renderInlineText: (value: string) => ReactNode;
	changedClass: (...fields: string[]) => string;
}

interface TokenSectionProps {
	monster: BestiaryMonster;
	effectiveName: string;
	sources: MonsterTokenSources;
	showDropzone: boolean;
	hasImageError: boolean;
	allowTokenUpload: boolean;
	tokenUploadCampaignSlug: string;
	hasTokenImageChange: boolean;
	dragPayload: TokenDragPayload | null;
	onUpload: (result: unknown) => void;
	onCancelReplace: () => void;
	onReplace: () => void;
	onImageError: () => void;
}

export function MonsterTokenSection({
	monster,
	sources,
	showDropzone,
	hasImageError,
	allowTokenUpload,
	tokenUploadCampaignSlug,
	hasTokenImageChange,
	dragPayload,
	onUpload,
	onCancelReplace,
	onReplace,
	onImageError,
}: TokenSectionProps) {
	const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
		if (!dragPayload) return;
		event.dataTransfer.effectAllowed = "copy";
		event.dataTransfer.setData("text/uri-list", dragPayload.uri);
		event.dataTransfer.setData("text/plain", dragPayload.uri);
		event.dataTransfer.setData("text/html", dragPayload.html);
		event.dataTransfer.setData("DownloadURL", dragPayload.downloadUrl);
	};

	return (
		<div className="MonsterStatBlock__token_wrapper">
			{showDropzone ? (
				<div className="MonsterStatBlock__token_dropzone">
					<ImageDropzone
						campaignSlug={tokenUploadCampaignSlug}
						initialSource={tokenUploadCampaignSlug}
						initialCategory="tokens"
						initialSubcategory=""
						onUploadSuccess={onUpload}
					/>
					{sources.customTokenSrc && !hasImageError && (
						<Button variant="ghost" size={Button.SIZES.SMALL} onClick={onCancelReplace}>
							{lang.t("Cancel")}
						</Button>
					)}
				</div>
			) : !hasImageError ? (
				<div className="MonsterStatBlock__tokenDragProxy" draggable onDragStart={handleDragStart}>
					<img
						src={sources.localSrc}
						alt={String(monster.name ?? "")}
						className="MonsterStatBlock__token"
						draggable={false}
						onError={onImageError}
					/>
					{allowTokenUpload && (sources.isCustomMonster || hasTokenImageChange) && (
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="image"
							className="MonsterStatBlock__replace_token_btn"
							onClick={onReplace}
							title={lang.t("Replace image")}
						/>
					)}
				</div>
			) : (
				<div className="MonsterStatBlock__token_skeleton"><Icon name="dice" /></div>
			)}
		</div>
	);
}

interface AbilitySectionProps {
	model: MonsterStatBlockModel;
	helpers: RenderHelpers;
	onRoll: (formula: string) => void;
}

const ABILITIES = [
	["STR", "str"], ["DEX", "dex"], ["CON", "con"],
	["INT", "int"], ["WIS", "wis"], ["CHA", "cha"],
] as const;

export function MonsterAbilities({ model, helpers, onRoll }: AbilitySectionProps) {
	return (
		<>
			{ABILITIES.map(([label, field]) => {
				const value = model.abilityScores[field];
				const modifier = getAbilityModifier(value);
				return (
					<Tooltip key={field} content={lang.t("Roll {label} check", { label })}>
						<div
							className={classNames("MonsterStatBlock__ability_box", helpers.changedClass(field))}
							onClick={() => onRoll(`1d20${formatModifier(modifier)}`)}
						>
							<span className="ability_label">{label}</span>
							<span className="ability_mod">{formatModifier(modifier)}</span>
							<span className="ability_score">{value}</span>
						</div>
					</Tooltip>
				);
			})}
		</>
	);
}

interface HeaderDetailsProps {
	monster: BestiaryMonster;
	model: MonsterStatBlockModel;
	sourceLabel: string;
	isGridLayout: boolean;
	isFavorite: boolean;
	showFavoriteAction: boolean;
	showAddToEncounterPicker: boolean;
	nameTitle?: ReactNode;
	onNameClick?: (monster: BestiaryMonster) => void;
	onFavorite: () => void;
	onAddToEncounter: () => void;
	onAiAction?: (monster: BestiaryMonster) => void;
	onDelete?: (monster: BestiaryMonster) => void;
	onFieldEdit?: (monster: BestiaryMonster) => void;
	onRoll: (formula: string) => void;
	helpers: RenderHelpers;
	renderSenses: () => ReactNode;
}

export function MonsterHeaderDetails(props: HeaderDetailsProps) {
	const { monster, model, helpers } = props;
	return (
		<div className="MonsterStatBlock__header__details">
			<MonsterNameRow {...props} />
			<MonsterMetadata monster={monster} model={model} sourceLabel={props.sourceLabel} helpers={helpers} />
			<div className="MonsterStatBlock__stats__wrap">
				<MonsterStats monster={monster} model={model} helpers={helpers} onRoll={props.onRoll} renderSenses={props.renderSenses} />
			</div>
			{!props.isGridLayout && <div className="MonsterStatBlock__abilities"><MonsterAbilities model={model} helpers={helpers} onRoll={props.onRoll} /></div>}
		</div>
	);
}

function MonsterNameRow(props: HeaderDetailsProps) {
	const { monster, helpers } = props;
	const name = String(monster.name ?? "");
	return (
		<div className="MonsterStatBlock__name__row">
			{props.onNameClick ? (
				<Tooltip content={props.nameTitle} disabled={!props.nameTitle}>
					<h3 className={classNames("MonsterStatBlock__name", helpers.changedClass("name"))} onClick={() => props.onNameClick?.(monster)}>{helpers.highlight(name)}</h3>
				</Tooltip>
			) : (
				<ClickToCopy className={classNames("MonsterStatBlock__name", helpers.changedClass("name"))} text={name} message={lang.t("Name copied!")}>{helpers.highlight(name)}</ClickToCopy>
			)}
			{props.showFavoriteAction && <Button variant="ghost" size={Button.SIZES.SMALL} icon="star" className={classNames("MonsterStatBlock__favorite_btn", { is_active: props.isFavorite })} onClick={props.onFavorite} title={props.isFavorite ? "Remove from favorites" : "Add to favorites"} />}
			{props.onAiAction && <Button variant="ghost" size={Button.SIZES.SMALL} icon="wand" className="MonsterStatBlock__ai_btn" onClick={() => props.onAiAction?.(monster)} title={lang.t("AI creature action")} />}
			{props.onFieldEdit && <Button variant="ghost" size={Button.SIZES.SMALL} icon="edit" className="MonsterStatBlock__edit_btn" onClick={() => props.onFieldEdit?.(monster)} title={lang.t("Edit creature")} />}
			{props.onDelete && <Button variant="danger" size={Button.SIZES.SMALL} icon="trash" className="MonsterStatBlock__delete_btn" onClick={() => props.onDelete?.(monster)} title={lang.t("Delete custom creature")} />}
			{props.showAddToEncounterPicker && <Button variant="primary" size={Button.SIZES.SMALL} icon="plus" className="MonsterStatBlock__add_to_encounter_btn" onClick={props.onAddToEncounter}>{lang.t("Add to encounter")}</Button>}
		</div>
	);
}

function MonsterMetadata({ monster, model, sourceLabel, helpers }: Pick<HeaderDetailsProps, "monster" | "model" | "sourceLabel" | "helpers">) {
	const name = String(monster.name ?? "");
	const originalName = typeof monster.originalBestiaryName === "string" && monster.originalBestiaryName !== name
		? monster.originalBestiaryName
		: "";
	return (
		<>
			{originalName && <div className={classNames("MonsterStatBlock__original_name muted", helpers.changedClass("originalBestiaryName"))}>({helpers.highlight(originalName)})</div>}
			<div className={classNames("MonsterStatBlock__meta_line", helpers.changedClass("size", "type", "alignment"))}>{helpers.highlight(model.size)} {helpers.highlight(model.typeLabel)}, {helpers.highlight(model.alignment)}</div>
			{sourceLabel && <div className={classNames("MonsterStatBlock__meta_line", helpers.changedClass("source"))}><strong>Source:</strong> {helpers.highlight(sourceLabel)}</div>}
		</>
	);
}

interface StatsProps {
	monster: BestiaryMonster;
	model: MonsterStatBlockModel;
	helpers: RenderHelpers;
	onRoll: (formula: string) => void;
	renderSenses: () => ReactNode;
}

function MonsterStats({ monster, model, helpers, renderSenses }: StatsProps) {
	const damageProperties = [
		["vulnerable", "Damage Vulnerabilities"],
		["resist", "Damage Resistances"],
		["immune", "Damage Immunities"],
		["conditionImmune", "Condition Immunities"],
	] as const;
	return (
		<>
			<div className="MonsterStatBlock__stats">
				<div className={classNames("stat_item", helpers.changedClass("hp", "hit_points"))}><strong>HP:</strong> {helpers.renderContent(model.hp.val)} {model.hp.formula && <>(<RollDice formula={model.hp.formula}>{helpers.highlight(model.hp.formula)}</RollDice>)</>}</div>
				<div className={classNames("stat_item ac", helpers.changedClass("ac", "armor_class"))}><strong>AC:</strong> {helpers.renderContent(model.ac.val)} {helpers.renderContent(model.ac.desc)}</div>
				<div className={classNames("stat_item", helpers.changedClass("speed"))}><strong>Speed:</strong> {helpers.highlight(model.speed)}</div>
			</div>
			<div className="MonsterStatBlock__properties">
				{model.saves.length > 0 && <div className={classNames("MonsterStatBlock__property_item", helpers.changedClass("save"))}><strong>Saving Throws:</strong>{" "}{model.saves.map((save, index) => <React.Fragment key={save.label}>{save.label} <RollDice formula={`1d20${formatModifier(Number.parseInt(String(save.val)))}`}>{formatModifier(Number.parseInt(String(save.val)))}</RollDice>{index < model.saves.length - 1 ? ", " : ""}</React.Fragment>)}</div>}
				{model.skills.length > 0 && <div className={classNames("MonsterStatBlock__property_item MonsterStatBlock__property_item__skills", helpers.changedClass("skill"))}><strong>Skills:</strong>{" "}{model.skills.map(([name, value], index) => <React.Fragment key={name}><span className="skill_name" style={{ textTransform: "capitalize" }}>{helpers.highlight(name)}</span>{" "}<RollDice formula={`1d20${formatModifier(Number.parseInt(String(value)))}`}>{formatModifier(Number.parseInt(String(value)))}</RollDice>{index < model.skills.length - 1 ? ", " : ""}</React.Fragment>)}</div>}
				{damageProperties.map(([field, label]) => monster[field] ? <div key={field} className={classNames("MonsterStatBlock__property_item", helpers.changedClass(field))}><strong>{label}:</strong>{" "}{helpers.highlight(model.formatDamageProperty(monster[field]))}</div> : null)}
				<div className="MonsterStatBlock__description">
					<p className={helpers.changedClass("senses")}><strong>Senses:</strong> {renderSenses()}</p>
					<p className={helpers.changedClass("languages")}><strong>Languages:</strong> {helpers.highlight(model.languages)}</p>
					<p className={helpers.changedClass("cr")}><strong>CR:</strong> {helpers.highlight(model.challenge)}</p>
				</div>
				{typeof monster.desc === "string" && <div className={classNames("MonsterStatBlock__lore", helpers.changedClass("desc"))}>{helpers.renderInlineText(monster.desc)}</div>}
			</div>
		</>
	);
}

interface SpellSectionProps { helpers: RenderHelpers; }

export function LegacySpellcastingSection({ loading, groups, helpers }: SpellSectionProps & { loading: boolean; groups: SpellLevelGroup[] }) {
	if (loading) return <div className="MonsterStatBlock__section"><p className="muted">Loading spells...</p></div>;
	if (groups.length === 0) return null;
	return <div className={classNames("MonsterStatBlock__section MonsterStatBlock__spells", helpers.changedClass("spell_list"))}><h4>Spells:</h4>{groups.map(({ level, spells }) => <div key={level}><strong>{level === "0" ? "Cantrip" : `${level}-level`}:</strong>{" "}<SpellLinks spells={spells} highlight={helpers.highlight} /></div>)}</div>;
}

function SpellLinks({ spells, highlight }: { spells: LoadedMonsterSpell[]; highlight: RenderHelpers["highlight"] }) {
	return <>{spells.map((spell, index) => <React.Fragment key={spell.slug ?? spell.name}><RulesLink type="spell" name={spell.name}>{highlight(capitalizeWords(spell.name.split("|")[0]))}</RulesLink>{index < spells.length - 1 ? ", " : ""}</React.Fragment>)}</>;
}

export function StructuredSpellcastingSection({ entries, helpers }: SpellSectionProps & { entries: MonsterSpellcastingEntry[] }) {
	if (entries.length === 0) return null;
	return <div className={classNames("MonsterStatBlock__section MonsterStatBlock__spells", helpers.changedClass("spellcasting"))}>{entries.map((entry, index) => <div key={`${entry.name}-${index}`} className="MonsterStatBlock__action"><h4>{entry.name}:</h4>{entry.headerEntries && <p>{helpers.renderContent(entry.headerEntries)}</p>}{entry.will && <SpellContentLine label="At will" values={entry.will} helpers={helpers} />}{entry.daily && Object.entries(entry.daily).map(([frequency, values]) => <SpellContentLine key={frequency} label={`${frequency} each`} values={values} helpers={helpers} />)}{entry.spells && Object.entries(entry.spells).map(([level, info]) => <SpellContentLine key={level} label={`${level === "0" ? "Cantrips" : `Level ${level}`} ${info.slots ? `(${info.slots} slots)` : ""}`.trim()} values={info.spells} helpers={helpers} />)}{entry.footerEntries && <p>{helpers.renderContent(entry.footerEntries)}</p>}</div>)}</div>;
}

function SpellContentLine({ label, values, helpers }: { label: string; values: unknown[]; helpers: RenderHelpers }) {
	return <p className="MonsterStatBlock__action"><strong>{label}:</strong>{" "}{values.map((value, index) => <React.Fragment key={index}>{helpers.renderContent(value)}{index < values.length - 1 ? ", " : ""}</React.Fragment>)}</p>;
}

export function MonsterActionList({ actions, title, field, helpers }: { actions: MonsterEntry[]; title: string; field: string; helpers: RenderHelpers }) {
	if (actions.length === 0) return null;
	return <div className={classNames("MonsterStatBlock__section", helpers.changedClass(field))}><h4>{title}:</h4>{actions.map((action, index) => <div key={index} className="MonsterStatBlock__action"><strong>{helpers.renderActionName(action.name)}.</strong>{" "}{helpers.renderContent(action.entries ?? action.desc)}<div className="MonsterStatBlock__action_rolls">{action.attack_bonus != null && <div className="stat_item">Atk:{" "}<RollDice formula={`1d20${formatModifier(Number.parseInt(String(action.attack_bonus)))}`}>{formatModifier(Number.parseInt(String(action.attack_bonus)))}</RollDice></div>}{action.damage_dice && <div className="stat_item">Dmg:{" "}<RollDice formula={`${action.damage_dice}${getDamageBonus(action)}`} /></div>}</div></div>)}</div>;
}

export function MonsterContentSection({ content, title, field, helpers }: { content: unknown[]; title: string; field: string; helpers: RenderHelpers }) {
	if (content.length === 0) return null;
	return <div className={classNames("MonsterStatBlock__section", helpers.changedClass(field))}><h4>{title}:</h4>{helpers.renderContent(content)}</div>;
}

export function renderSenseParts(parts: SenseTextPart[], helpers: RenderHelpers): ReactNode {
	return parts.map((part, index) => part.kind === "reference"
		? <RulesLink key={`sense-link-${index}`} type="sense" name={part.name}>{helpers.highlight(part.name)}</RulesLink>
		: <React.Fragment key={`sense-text-${index}`}>{helpers.renderInlineText(part.text)}</React.Fragment>);
}
