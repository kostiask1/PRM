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
import { classNames, lang } from "../../../shared/lib/index.js";
import { Button, Icon, Tooltip } from "../../../shared/ui/index.js";
import type {
	LoadedMonsterSpell,
	MonsterNameRowPresentation,
	MonsterSpellcastingEntryPresentation,
	MonsterSpellcastingEntry,
	MonsterTokenSectionPresentation,
	MonsterTokenSources,
	SenseTextPart,
	SpellLevelGroup,
	TokenDragPayload,
} from "../model/monsterStatBlockPresentation.ts";
import {
	executeMonsterAction,
	getMonsterMetadataPresentation,
	getMonsterNameRowPresentation,
	getMonsterSpellcastingEntryPresentation,
	getMonsterTokenSectionPresentation,
} from "../model/monsterStatBlockPresentation.ts";
import { MonsterStatBlockRulesLink } from "./monsterStatBlockRichContent.ts";

export interface RenderHelpers {
	highlight: (value: unknown) => ReactNode;
	renderContent: (value: unknown) => ReactNode;
	renderActionName: (value: unknown) => ReactNode;
	renderInlineText: (value: string) => ReactNode;
	changedClass: (...fields: string[]) => string;
}

interface TokenSectionProps {
	monster: BestiaryMonster;
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

function applyTokenDragPayload(
	event: DragEvent<HTMLDivElement>,
	dragPayload: TokenDragPayload | null,
): void {
	if (!dragPayload) return;
	event.dataTransfer.effectAllowed = "copy";
	event.dataTransfer.setData("text/uri-list", dragPayload.uri);
	event.dataTransfer.setData("text/plain", dragPayload.uri);
	event.dataTransfer.setData("text/html", dragPayload.html);
	event.dataTransfer.setData("DownloadURL", dragPayload.downloadUrl);
}

function MonsterTokenDropzone({
	tokenUploadCampaignSlug,
	onUpload,
	onCancelReplace,
	presentation,
}: Pick<
	TokenSectionProps,
	"tokenUploadCampaignSlug" | "onUpload" | "onCancelReplace"
> & { presentation: MonsterTokenSectionPresentation }) {
	return (
		<div className="MonsterStatBlock__tokenDropzone">
			<ImageDropzone
				campaignSlug={tokenUploadCampaignSlug}
				initialSource={tokenUploadCampaignSlug}
				initialCategory="tokens"
				initialSubcategory=""
				onUploadSuccess={onUpload}
			/>
			{presentation.showCancelReplace && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					onClick={onCancelReplace}
				>
					{lang.t("Cancel")}
				</Button>
			)}
		</div>
	);
}

function MonsterTokenImage({
	monster,
	sources,
	dragPayload,
	onReplace,
	onImageError,
	presentation,
}: Pick<
	TokenSectionProps,
	"monster" | "sources" | "dragPayload" | "onReplace" | "onImageError"
> & { presentation: MonsterTokenSectionPresentation }) {
	return (
		<div
			className="MonsterStatBlock__tokenDragProxy"
			draggable
			onDragStart={(event) => applyTokenDragPayload(event, dragPayload)}
		>
			<img
				src={sources.localSrc}
				alt={String(monster.name ?? "")}
				className="MonsterStatBlock__token"
				draggable={false}
				onError={onImageError}
			/>
			{presentation.showReplaceAction && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="image"
					className="MonsterStatBlock__replaceTokenButton"
					onClick={onReplace}
					title={lang.t("Replace image")}
				/>
			)}
		</div>
	);
}

function MonsterTokenContent(
	props: TokenSectionProps & { presentation: MonsterTokenSectionPresentation },
) {
	switch (props.presentation.mode) {
		case "dropzone":
			return <MonsterTokenDropzone {...props} />;
		case "image":
			return <MonsterTokenImage {...props} />;
		default:
			return (
				<div className="MonsterStatBlock__token_skeleton">
					<Icon name="dice" />
				</div>
			);
	}
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
	const presentation = getMonsterTokenSectionPresentation({
		showDropzone,
		hasImageError,
		allowTokenUpload,
		customTokenSrc: sources.customTokenSrc,
		isCustomMonster: sources.isCustomMonster,
		hasTokenImageChange,
	});

	return (
		<div className="MonsterStatBlock__token_wrapper">
			<MonsterTokenContent
				monster={monster}
				sources={sources}
				showDropzone={showDropzone}
				hasImageError={hasImageError}
				allowTokenUpload={allowTokenUpload}
				tokenUploadCampaignSlug={tokenUploadCampaignSlug}
				hasTokenImageChange={hasTokenImageChange}
				dragPayload={dragPayload}
				onUpload={onUpload}
				onCancelReplace={onCancelReplace}
				onReplace={onReplace}
				onImageError={onImageError}
				presentation={presentation}
			/>
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
							<span className="MonsterStatBlock__abilityLabel">{label}</span>
							<span className="MonsterStatBlock__abilityModifier">{formatModifier(modifier)}</span>
							<span className="MonsterStatBlock__abilityScore">{value}</span>
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
	const presentation = getMonsterNameRowPresentation({
		name: monster.name,
		hasNameAction: Boolean(props.onNameClick),
		showFavoriteAction: props.showFavoriteAction,
		isFavorite: props.isFavorite,
		hasAiAction: Boolean(props.onAiAction),
		hasFieldEditAction: Boolean(props.onFieldEdit),
		hasDeleteAction: Boolean(props.onDelete),
		showAddToEncounterAction: props.showAddToEncounterPicker,
	});
	const nameClass = classNames(
		"MonsterStatBlock__name",
		helpers.changedClass("name"),
	);
	return (
		<div className="MonsterStatBlock__nameRow">
			<MonsterNameControl
				monster={monster}
				presentation={presentation}
				nameClass={nameClass}
				nameTitle={props.nameTitle}
				onNameClick={props.onNameClick}
				highlight={helpers.highlight}
			/>
			<MonsterFavoriteAction
				presentation={presentation}
				onFavorite={props.onFavorite}
			/>
			<MonsterCallbackAction
				monster={monster}
				visible={presentation.showAiAction}
				onAction={props.onAiAction}
				variant="ghost"
				icon="wand"
				className="MonsterStatBlock__aiButton"
				titleKey="AI creature action"
			/>
			<MonsterCallbackAction
				monster={monster}
				visible={presentation.showFieldEditAction}
				onAction={props.onFieldEdit}
				variant="ghost"
				icon="edit"
				className="MonsterStatBlock__editButton"
				titleKey="Edit creature"
			/>
			<MonsterCallbackAction
				monster={monster}
				visible={presentation.showDeleteAction}
				onAction={props.onDelete}
				variant="danger"
				icon="trash"
				className="MonsterStatBlock__deleteButton"
				titleKey="Delete custom creature"
			/>
			<MonsterAddToEncounterAction
				visible={presentation.showAddToEncounterAction}
				onAdd={props.onAddToEncounter}
			/>
		</div>
	);
}

interface MonsterNameControlProps {
	monster: BestiaryMonster;
	presentation: MonsterNameRowPresentation;
	nameClass: string;
	nameTitle?: ReactNode;
	onNameClick?: (monster: BestiaryMonster) => void;
	highlight: RenderHelpers["highlight"];
}

function MonsterNameControl({
	monster,
	presentation,
	nameClass,
	nameTitle,
	onNameClick,
	highlight,
}: MonsterNameControlProps) {
	if (presentation.useNameAction) {
		return (
			<Tooltip content={nameTitle} disabled={!nameTitle}>
				<h3
					className={nameClass}
					onClick={() => executeMonsterAction(onNameClick, monster)}
				>
					{highlight(presentation.name)}
				</h3>
			</Tooltip>
		);
	}
	return (
		<ClickToCopy
			className={nameClass}
			text={presentation.name}
			message={lang.t("Name copied!")}
		>
			{highlight(presentation.name)}
		</ClickToCopy>
	);
}

function MonsterFavoriteAction({
	presentation,
	onFavorite,
}: {
	presentation: MonsterNameRowPresentation;
	onFavorite: () => void;
}) {
	if (!presentation.showFavoriteAction) return null;
	return (
		<Button
			variant="ghost"
			size={Button.SIZES.SMALL}
			icon="star"
			className={classNames("MonsterStatBlock__favoriteButton", {
				is_active: presentation.favoriteActive,
			})}
			onClick={onFavorite}
			title={presentation.favoriteTitle}
		/>
	);
}

interface MonsterCallbackActionProps {
	monster: BestiaryMonster;
	visible: boolean;
	onAction?: (monster: BestiaryMonster) => void;
	variant: "ghost" | "danger";
	icon: "wand" | "edit" | "trash";
	className: string;
	titleKey: string;
}

function MonsterCallbackAction({
	monster,
	visible,
	onAction,
	variant,
	icon,
	className,
	titleKey,
}: MonsterCallbackActionProps) {
	if (!visible || !onAction) return null;
	return (
		<Button
			variant={variant}
			size={Button.SIZES.SMALL}
			icon={icon}
			className={className}
			onClick={() => executeMonsterAction(onAction, monster)}
			title={lang.t(titleKey)}
		/>
	);
}

function MonsterAddToEncounterAction({
	visible,
	onAdd,
}: {
	visible: boolean;
	onAdd: () => void;
}) {
	if (!visible) return null;
	return (
		<Button
			variant="primary"
			size={Button.SIZES.SMALL}
			icon="plus"
			className="MonsterStatBlock__addToEncounterButton"
			onClick={onAdd}
		>
			{lang.t("Add to encounter")}
		</Button>
	);
}

function MonsterMetadata({ monster, model, sourceLabel, helpers }: Pick<HeaderDetailsProps, "monster" | "model" | "sourceLabel" | "helpers">) {
	const presentation = getMonsterMetadataPresentation(monster, sourceLabel);
	return (
		<>
			<MonsterOriginalName presentation={presentation} helpers={helpers} />
			<div className={classNames("MonsterStatBlock__metaLine", helpers.changedClass("size", "type", "alignment"))}>{helpers.highlight(model.size)} {helpers.highlight(model.typeLabel)}, {helpers.highlight(model.alignment)}</div>
			<MonsterSourceLine
				presentation={presentation}
				sourceLabel={sourceLabel}
				helpers={helpers}
			/>
		</>
	);
}

function MonsterOriginalName({
	presentation,
	helpers,
}: {
	presentation: ReturnType<typeof getMonsterMetadataPresentation>;
	helpers: RenderHelpers;
}) {
	if (!presentation.showOriginalName) return null;
	return (
		<div
			className={classNames(
				"MonsterStatBlock__original_name muted",
				helpers.changedClass("originalBestiaryName"),
			)}
		>
			({helpers.highlight(presentation.originalName)})
		</div>
	);
}

function MonsterSourceLine({
	presentation,
	sourceLabel,
	helpers,
}: {
	presentation: ReturnType<typeof getMonsterMetadataPresentation>;
	sourceLabel: string;
	helpers: RenderHelpers;
}) {
	if (!presentation.showSource) return null;
	return (
		<div
			className={classNames(
				"MonsterStatBlock__metaLine",
				helpers.changedClass("source"),
			)}
		>
			<strong>Source:</strong> {helpers.highlight(sourceLabel)}
		</div>
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
				<div className={classNames("MonsterStatBlock__statItem", helpers.changedClass("hp", "hit_points"))}><strong>HP:</strong> {helpers.renderContent(model.hp.val)} {model.hp.formula && <>(<RollDice formula={model.hp.formula}>{helpers.highlight(model.hp.formula)}</RollDice>)</>}</div>
				<div className={classNames("MonsterStatBlock__statItem MonsterStatBlock__statItem_ac", helpers.changedClass("ac", "armor_class"))}><strong>AC:</strong> {helpers.renderContent(model.ac.val)} {helpers.renderContent(model.ac.desc)}</div>
				<div className={classNames("MonsterStatBlock__statItem", helpers.changedClass("speed"))}><strong>Speed:</strong> {helpers.highlight(model.speed)}</div>
			</div>
			<div className="MonsterStatBlock__properties">
				{model.saves.length > 0 && <div className={classNames("MonsterStatBlock__propertyItem", helpers.changedClass("save"))}><strong>Saving Throws:</strong>{" "}{model.saves.map((save, index) => <React.Fragment key={save.label}>{save.label} <RollDice formula={`1d20${formatModifier(Number.parseInt(String(save.val)))}`}>{formatModifier(Number.parseInt(String(save.val)))}</RollDice>{index < model.saves.length - 1 ? ", " : ""}</React.Fragment>)}</div>}
				{model.skills.length > 0 && <div className={classNames("MonsterStatBlock__propertyItem MonsterStatBlock__propertyItem_skills", helpers.changedClass("skill"))}><strong>Skills:</strong>{" "}{model.skills.map(([name, value], index) => <React.Fragment key={name}><span style={{ textTransform: "capitalize" }}>{helpers.highlight(name)}</span>{" "}<RollDice formula={`1d20${formatModifier(Number.parseInt(String(value)))}`}>{formatModifier(Number.parseInt(String(value)))}</RollDice>{index < model.skills.length - 1 ? ", " : ""}</React.Fragment>)}</div>}
				{damageProperties.map(([field, label]) => monster[field] ? <div key={field} className={classNames("MonsterStatBlock__propertyItem", helpers.changedClass(field))}><strong>{label}:</strong>{" "}{helpers.highlight(model.formatDamageProperty(monster[field]))}</div> : null)}
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
	return <>{spells.map((spell, index) => <React.Fragment key={spell.slug ?? spell.name}><MonsterStatBlockRulesLink type="spell" name={spell.name}>{highlight(capitalizeWords(spell.name.split("|")[0]))}</MonsterStatBlockRulesLink>{index < spells.length - 1 ? ", " : ""}</React.Fragment>)}</>;
}

export function StructuredSpellcastingSection({ entries, helpers }: SpellSectionProps & { entries: MonsterSpellcastingEntry[] }) {
	if (entries.length === 0) return null;
	return (
		<div
			className={classNames(
				"MonsterStatBlock__section MonsterStatBlock__spells",
				helpers.changedClass("spellcasting"),
			)}
		>
			{entries.map((entry, index) => (
				<StructuredSpellcastingEntry
					key={`${entry.name}-${index}`}
					entry={entry}
					helpers={helpers}
				/>
			))}
		</div>
	);
}

function StructuredSpellcastingEntry({
	entry,
	helpers,
}: {
	entry: MonsterSpellcastingEntry;
	helpers: RenderHelpers;
}) {
	const presentation = getMonsterSpellcastingEntryPresentation(entry);
	return (
		<div className="MonsterStatBlock__action">
			<h4>{entry.name}:</h4>
			{presentation.headerEntries && (
				<p>{helpers.renderContent(presentation.headerEntries)}</p>
			)}
			<OptionalSpellContentLine
				line={presentation.willLine}
				helpers={helpers}
			/>
			<SpellContentLines lines={presentation.dailyLines} helpers={helpers} />
			<SpellContentLines lines={presentation.spellLines} helpers={helpers} />
			{presentation.footerEntries && (
				<p>{helpers.renderContent(presentation.footerEntries)}</p>
			)}
		</div>
	);
}

function OptionalSpellContentLine({
	line,
	helpers,
}: {
	line: MonsterSpellcastingEntryPresentation["willLine"];
	helpers: RenderHelpers;
}) {
	if (!line) return null;
	return <SpellContentLine label={line.label} values={line.values} helpers={helpers} />;
}

function SpellContentLines({
	lines,
	helpers,
}: {
	lines: MonsterSpellcastingEntryPresentation["dailyLines"];
	helpers: RenderHelpers;
}) {
	return lines.map((line) => (
		<SpellContentLine
			key={line.key}
			label={line.label}
			values={line.values}
			helpers={helpers}
		/>
	));
}

function SpellContentLine({ label, values, helpers }: { label: string; values: unknown[]; helpers: RenderHelpers }) {
	return <p className="MonsterStatBlock__action"><strong>{label}:</strong>{" "}{values.map((value, index) => <React.Fragment key={index}>{helpers.renderContent(value)}{index < values.length - 1 ? ", " : ""}</React.Fragment>)}</p>;
}

export function MonsterActionList({ actions, title, field, helpers }: { actions: MonsterEntry[]; title: string; field: string; helpers: RenderHelpers }) {
	if (actions.length === 0) return null;
	return <div className={classNames("MonsterStatBlock__section", helpers.changedClass(field))}><h4>{title}:</h4>{actions.map((action, index) => <div key={index} className="MonsterStatBlock__action"><strong>{helpers.renderActionName(action.name)}.</strong>{" "}{helpers.renderContent(action.entries ?? action.desc)}<div className="MonsterStatBlock__actionRolls">{action.attack_bonus != null && <div className="MonsterStatBlock__statItem">Atk:{" "}<RollDice formula={`1d20${formatModifier(Number.parseInt(String(action.attack_bonus)))}`}>{formatModifier(Number.parseInt(String(action.attack_bonus)))}</RollDice></div>}{action.damage_dice && <div className="MonsterStatBlock__statItem">Dmg:{" "}<RollDice formula={`${action.damage_dice}${getDamageBonus(action)}`} /></div>}</div></div>)}</div>;
}

export function MonsterContentSection({ content, title, field, helpers }: { content: unknown[]; title: string; field: string; helpers: RenderHelpers }) {
	if (content.length === 0) return null;
	return <div className={classNames("MonsterStatBlock__section", helpers.changedClass(field))}><h4>{title}:</h4>{helpers.renderContent(content)}</div>;
}

export function renderSenseParts(parts: SenseTextPart[], helpers: RenderHelpers): ReactNode {
	return parts.map((part, index) => part.kind === "reference"
		? <MonsterStatBlockRulesLink key={`sense-link-${index}`} type="sense" name={part.name}>{helpers.highlight(part.name)}</MonsterStatBlockRulesLink>
		: <React.Fragment key={`sense-text-${index}`}>{helpers.renderInlineText(part.text)}</React.Fragment>);
}
