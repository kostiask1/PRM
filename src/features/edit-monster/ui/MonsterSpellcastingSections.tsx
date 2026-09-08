import { type KeyboardEvent, useEffect, useState } from "react";

import type {
	MonsterData,
	MonsterSpellcasting,
} from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, Select, TextInput } from "../../../shared/ui/index.js";
import {
	MONSTER_SPELLCASTING_BUCKET_KEYS,
	addMonsterSpellcastingBlock,
	addMonsterSpellcastingBucketGroup,
	addMonsterSpellcastingItem,
	addMonsterSpellcastingLevel,
	getMonsterSpellcastingBlocks,
	getMonsterSpellcastingBucketGroups,
	getMonsterSpellcastingItems,
	getMonsterSpellcastingItemText,
	getMonsterSpellcastingLevels,
	getMonsterSpellcastingScalar,
	moveMonsterSpellcastingBlock,
	moveMonsterSpellcastingItem,
	removeMonsterSpellcastingBlock,
	removeMonsterSpellcastingBucketGroup,
	removeMonsterSpellcastingItem,
	removeMonsterSpellcastingLevel,
	renameMonsterSpellcastingBucketGroup,
	renameMonsterSpellcastingLevel,
	replaceMonsterSpellcastingItem,
	updateMonsterSpellcastingBlock,
	updateMonsterSpellcastingItemText,
	updateMonsterSpellcastingLevel,
	updateMonsterSpellcastingScalar,
	type MonsterSpellcastingBlock,
	type MonsterSpellcastingBucketKey,
	type MonsterSpellcastingItemTarget,
	type MonsterSpellcastingRichListKey,
} from "../model/monsterSpellcasting.ts";
import { isRulesReferenceShortcut } from "../model.ts";
import MonsterJsonValueInput from "./MonsterJsonValueInput.tsx";

export interface MonsterNestedParserRequest {
	context: "action-name" | "rich-text";
	onChange: (value: string) => void;
	selectionEnd: number;
	selectionStart: number;
	targetId: string;
	value: string;
}

interface MonsterSpellcastingSectionsProps {
	draft: MonsterData;
	onChange: (monster: MonsterData) => void;
	onOpenParser: (request: MonsterNestedParserRequest) => void;
}

const ABILITY_OPTIONS = ["", "str", "dex", "con", "int", "wis", "cha"];
const DISPLAY_AS_OPTIONS = [
	"",
	"trait",
	"action",
	"bonus",
	"reaction",
	"legendary",
];
const HIDDEN_OPTIONS = [
	"will",
	"daily",
	"spells",
	"rest",
	"restLong",
	"recharge",
	"legendary",
	"charges",
	"ritual",
] as const;

const RICH_LIST_LABELS: Record<MonsterSpellcastingRichListKey, string> = {
	headerEntries: "Introductory text",
	footerEntries: "Footer text",
	will: "At will",
	ritual: "Rituals",
};

const BUCKET_LABELS: Record<MonsterSpellcastingBucketKey, string> = {
	daily: "Per day",
	rest: "Per short or long rest",
	restLong: "Per long rest",
	recharge: "Recharge",
	legendary: "Legendary-action cost",
	charges: "Charges",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parserTargetKey(
	blockIndex: number,
	target: MonsterSpellcastingItemTarget,
	itemIndex: number,
): string {
	if (target.kind === "rich") {
		return `spellcasting-${blockIndex}-${target.key}-${itemIndex}`;
	}
	if (target.kind === "bucket") {
		return `spellcasting-${blockIndex}-${target.key}-${target.group}-${itemIndex}`;
	}
	return `spellcasting-${blockIndex}-spells-${target.level}-${itemIndex}`;
}

function getUniqueKey(keys: string[], preferred: string): string {
	const used = new Set(keys);
	if (!used.has(preferred)) return preferred;
	let suffix = 2;
	while (used.has(`${preferred}${suffix}`)) suffix += 1;
	return `${preferred}${suffix}`;
}

function requestParserFromField(
	event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
	targetId: string,
	value: string,
	onChange: (value: string) => void,
	onOpenParser: MonsterSpellcastingSectionsProps["onOpenParser"],
	context: MonsterNestedParserRequest["context"] = "rich-text",
) {
	if (!isRulesReferenceShortcut(event)) return;
	event.preventDefault();
	event.stopPropagation();
	onOpenParser({
		context,
		onChange,
		selectionStart: event.currentTarget.selectionStart ?? value.length,
		selectionEnd:
			event.currentTarget.selectionEnd ??
			event.currentTarget.selectionStart ??
			value.length,
		targetId,
		value,
	});
}

function EditableMapKey({
	ariaLabel,
	value,
	onCommit,
}: {
	ariaLabel: string;
	value: string;
	onCommit: (value: string) => void;
}) {
	const [draftValue, setDraftValue] = useState(value);
	useEffect(() => setDraftValue(value), [value]);
	return (
		<TextInput
			aria-label={ariaLabel}
			value={draftValue}
			onChange={(event) => setDraftValue(event.target.value)}
			onBlur={() => {
				onCommit(draftValue);
				setDraftValue(value);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter") event.currentTarget.blur();
			}}
		/>
	);
}

interface SpellItemListProps extends MonsterSpellcastingSectionsProps {
	blockIndex: number;
	label: string;
	target: MonsterSpellcastingItemTarget;
}

function SpellItemList({
	draft,
	blockIndex,
	label,
	target,
	onChange,
	onOpenParser,
}: SpellItemListProps) {
	const block = getMonsterSpellcastingBlocks(draft)[blockIndex] || {};
	const items = getMonsterSpellcastingItems(block, target);
	return (
		<div className="MonsterFieldEditModal__spell_list_editor">
			<div className="MonsterFieldEditModal__compact_header">
				<strong>{lang.t(label)}</strong>
				<div className="MonsterFieldEditModal__row_actions">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="magic"
						onClick={() =>
							onOpenParser({
								context: "rich-text",
								targetId: parserTargetKey(blockIndex, target, items.length),
								value: "",
								selectionStart: 0,
								selectionEnd: 0,
								onChange: (value) =>
									onChange(
										addMonsterSpellcastingItem(
											draft,
											blockIndex,
											target,
											value,
										),
									),
							})
						}
					>
						{lang.t("Choose template")}
					</Button>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="plus"
						onClick={() =>
							onChange(addMonsterSpellcastingItem(draft, blockIndex, target))
						}
					>
						{lang.t("Add spell or text")}
					</Button>
				</div>
			</div>
			{items.length === 0 ? (
				<span className="MonsterFieldEditModal__empty">
					{lang.t("No entries.")}
				</span>
			) : (
				<div className="MonsterFieldEditModal__spell_items">
					{items.map((item, itemIndex) => {
						const targetId = parserTargetKey(blockIndex, target, itemIndex);
						const text = getMonsterSpellcastingItemText(item);
						const isEditableText =
							typeof item === "string" ||
							(isRecord(item) && typeof item.entry === "string");
						return (
							<div
								key={`${targetId}-${itemIndex}`}
								className="MonsterFieldEditModal__spell_item"
							>
								<div className="MonsterFieldEditModal__spell_item_body">
									{isEditableText ? (
										<textarea
											className="Input Input__textarea MonsterFieldEditModal__spell_textarea"
											rows={2}
											value={text}
											data-parser-target={targetId}
											title={lang.t("Ctrl+K — Insert parsed content")}
											onChange={(event) =>
												onChange(
													updateMonsterSpellcastingItemText(
														draft,
														blockIndex,
														target,
														itemIndex,
														event.target.value,
													),
												)
											}
											onKeyDown={(event) =>
												requestParserFromField(
													event,
													targetId,
													text,
													(value) =>
														onChange(
															updateMonsterSpellcastingItemText(
																draft,
																blockIndex,
																target,
																itemIndex,
																value,
															),
														),
													onOpenParser,
												)
											}
										/>
									) : (
										<MonsterJsonValueInput
											ariaLabel={lang.t("Structured spell entry")}
											value={item}
											onChange={(value) =>
												onChange(
													replaceMonsterSpellcastingItem(
														draft,
														blockIndex,
														target,
														itemIndex,
														value,
													),
												)
											}
										/>
									)}
									{isEditableText && (
										<label className="MonsterFieldEditModal__checkbox">
											<input
												type="checkbox"
												checked={isRecord(item) && item.hidden === true}
												onChange={(event) =>
													onChange(
														replaceMonsterSpellcastingItem(
															draft,
															blockIndex,
															target,
															itemIndex,
															isRecord(item)
																? { ...item, hidden: event.target.checked }
																: event.target.checked
																	? { entry: text, hidden: true }
																	: item,
														),
													)
												}
											/>
											{lang.t("Hidden")}
										</label>
									)}
								</div>
								<div className="MonsterFieldEditModal__row_actions">
									{isEditableText && (
										<Button
											variant="ghost"
											size={Button.SIZES.SMALL}
											icon="magic"
											title={lang.t("Open templates (Ctrl+K)")}
											aria-label={lang.t("Open templates (Ctrl+K)")}
											onClick={() =>
												onOpenParser({
													context: "rich-text",
													targetId,
													value: text,
													selectionStart: text.length,
													selectionEnd: text.length,
													onChange: (value) =>
														onChange(
															updateMonsterSpellcastingItemText(
																draft,
																blockIndex,
																target,
																itemIndex,
																value,
															),
														),
												})
											}
										/>
									)}
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										disabled={itemIndex === 0}
										onClick={() =>
											onChange(
												moveMonsterSpellcastingItem(
													draft,
													blockIndex,
													target,
													itemIndex,
													itemIndex - 1,
												),
											)
										}
										aria-label={lang.t("Move up")}
									>
										↑
									</Button>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										disabled={itemIndex === items.length - 1}
										onClick={() =>
											onChange(
												moveMonsterSpellcastingItem(
													draft,
													blockIndex,
													target,
													itemIndex,
													itemIndex + 1,
												),
											)
										}
										aria-label={lang.t("Move down")}
									>
										↓
									</Button>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="trash"
										onClick={() =>
											onChange(
												removeMonsterSpellcastingItem(
													draft,
													blockIndex,
													target,
													itemIndex,
												),
											)
										}
										aria-label={lang.t("Remove entry")}
									/>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function SpellcastingBucketEditor(
	props: MonsterSpellcastingSectionsProps & {
		block: MonsterSpellcastingBlock;
		blockIndex: number;
		bucket: MonsterSpellcastingBucketKey;
	},
) {
	const { draft, block, blockIndex, bucket, onChange } = props;
	const groups = getMonsterSpellcastingBucketGroups(block, bucket);
	return (
		<section className="MonsterFieldEditModal__spell_bucket">
			<div className="MonsterFieldEditModal__compact_header">
				<strong>{lang.t(BUCKET_LABELS[bucket])}</strong>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="plus"
					onClick={() =>
						onChange(
							addMonsterSpellcastingBucketGroup(
								draft,
								blockIndex,
								bucket,
								getUniqueKey(
									groups.map((group) => group.key),
									bucket === "daily" || bucket === "charges" ? "1e" : "1",
								),
							),
						)
					}
				>
					{lang.t("Add frequency")}
				</Button>
			</div>
			{groups.map((group) => (
				<div
					key={`${bucket}-${group.key}`}
					className="MonsterFieldEditModal__spell_group"
				>
					<div className="MonsterFieldEditModal__spell_group_header">
						<label className="MonsterFieldEditModal__field">
							<span className="MonsterFieldEditModal__field_label">
								{lang.t("Frequency key")}
							</span>
							<EditableMapKey
								ariaLabel={lang.t("Frequency key")}
								value={group.key}
								onCommit={(value) =>
									onChange(
										renameMonsterSpellcastingBucketGroup(
											draft,
											blockIndex,
											bucket,
											group.key,
											value,
										),
									)
								}
							/>
						</label>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="trash"
							onClick={() =>
								onChange(
									removeMonsterSpellcastingBucketGroup(
										draft,
										blockIndex,
										bucket,
										group.key,
									),
								)
							}
							aria-label={lang.t("Remove frequency")}
						/>
					</div>
					<SpellItemList
						{...props}
						label="Spells and text"
						target={{ kind: "bucket", key: bucket, group: group.key }}
					/>
				</div>
			))}
		</section>
	);
}

function LeveledSpellsEditor(
	props: MonsterSpellcastingSectionsProps & {
		block: MonsterSpellcastingBlock;
		blockIndex: number;
	},
) {
	const { draft, block, blockIndex, onChange } = props;
	const levels = getMonsterSpellcastingLevels(block);
	return (
		<section className="MonsterFieldEditModal__spell_bucket">
			<div className="MonsterFieldEditModal__compact_header">
				<strong>{lang.t("Spell slots by level")}</strong>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="plus"
					onClick={() =>
						onChange(
							addMonsterSpellcastingLevel(
								draft,
								blockIndex,
								getUniqueKey(
									levels.map((level) => level.level),
									"0",
								),
							),
						)
					}
				>
					{lang.t("Add spell level")}
				</Button>
			</div>
			{levels.map((level) => (
				<div
					key={`level-${level.level}`}
					className="MonsterFieldEditModal__spell_group"
				>
					<div className="MonsterFieldEditModal__level_fields">
						<label className="MonsterFieldEditModal__field">
							<span className="MonsterFieldEditModal__field_label">
								{lang.t("Level")}
							</span>
							<EditableMapKey
								ariaLabel={lang.t("Level")}
								value={level.level}
								onCommit={(value) =>
									onChange(
										renameMonsterSpellcastingLevel(
											draft,
											blockIndex,
											level.level,
											value,
										),
									)
								}
							/>
						</label>
						<label className="MonsterFieldEditModal__field">
							<span className="MonsterFieldEditModal__field_label">
								{lang.t("Slots")}
							</span>
							<TextInput
								type="number"
								min={0}
								value={level.slots ?? ""}
								onChange={(event) =>
									onChange(
										updateMonsterSpellcastingLevel(
											draft,
											blockIndex,
											level.level,
											{
												slots:
													event.target.value === ""
														? null
														: Number(event.target.value),
											},
										),
									)
								}
							/>
						</label>
						<label className="MonsterFieldEditModal__field">
							<span className="MonsterFieldEditModal__field_label">
								{lang.t("Lowest level")}
							</span>
							<TextInput
								type="number"
								min={0}
								value={typeof level.lower === "number" ? level.lower : ""}
								onChange={(event) =>
									onChange(
										updateMonsterSpellcastingLevel(
											draft,
											blockIndex,
											level.level,
											{
												lower:
													event.target.value === ""
														? null
														: Number(event.target.value),
											},
										),
									)
								}
							/>
						</label>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="trash"
							onClick={() =>
								onChange(
									removeMonsterSpellcastingLevel(
										draft,
										blockIndex,
										level.level,
									),
								)
							}
							aria-label={lang.t("Remove spell level")}
						/>
					</div>
					<SpellItemList
						{...props}
						label="Spells"
						target={{ kind: "level", level: level.level }}
					/>
				</div>
			))}
		</section>
	);
}

function HiddenFieldsEditor({
	draft,
	block,
	blockIndex,
	onChange,
}: Pick<
	MonsterSpellcastingSectionsProps,
	"draft" | "onChange"
> & {
	block: MonsterSpellcasting;
	blockIndex: number;
}) {
	const hidden = Array.isArray(block.hidden)
		? block.hidden.filter((item): item is string => typeof item === "string")
		: [];
	return (
		<fieldset className="MonsterFieldEditModal__hidden_fields">
			<legend>{lang.t("Do not repeat these generated lists on the card")}</legend>
			{HIDDEN_OPTIONS.map((key) => (
				<label key={key} className="MonsterFieldEditModal__checkbox">
					<input
						type="checkbox"
						checked={hidden.includes(key)}
						onChange={(event) => {
							const next = event.target.checked
								? [...hidden, key]
								: hidden.filter((item) => item !== key);
							onChange(
								updateMonsterSpellcastingBlock(draft, blockIndex, {
									hidden: next,
								}),
							);
						}}
					/>
					{key}
				</label>
			))}
		</fieldset>
	);
}

function scalarSelectOptions(options: string[], current: string): string[] {
	return current && !options.includes(current) ? [...options, current] : options;
}

function SpellcastingBlockEditor(
	props: MonsterSpellcastingSectionsProps & {
		block: MonsterSpellcastingBlock;
		blockCount: number;
		blockIndex: number;
	},
) {
	const { draft, block, blockCount, blockIndex, onChange, onOpenParser } = props;
	const name = getMonsterSpellcastingScalar(block, "name");
	const nameTargetId = `spellcasting-${blockIndex}-name`;
	const updateScalar = (
		key: "name" | "type" | "ability" | "displayAs" | "chargesItem",
		value: string,
	) =>
		onChange(
			updateMonsterSpellcastingScalar(
				draft,
				blockIndex,
				key,
				value || undefined,
			),
		);
	return (
		<details className="MonsterFieldEditModal__spell_block" open>
			<summary>
				<span>{name || `${lang.t("Spellcasting block")} ${blockIndex + 1}`}</span>
				<span className="MonsterFieldEditModal__summary_meta">
					{getMonsterSpellcastingScalar(block, "displayAs") || lang.t("Traits")}
				</span>
			</summary>
			<div className="MonsterFieldEditModal__spell_block_body">
				<div className="MonsterFieldEditModal__spell_block_header">
					<div className="MonsterFieldEditModal__row_actions">
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							disabled={blockIndex === 0}
							onClick={() =>
								onChange(
									moveMonsterSpellcastingBlock(
										draft,
										blockIndex,
										blockIndex - 1,
									),
								)
							}
							aria-label={lang.t("Move up")}
						>
							↑
						</Button>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							disabled={blockIndex === blockCount - 1}
							onClick={() =>
								onChange(
									moveMonsterSpellcastingBlock(
										draft,
										blockIndex,
										blockIndex + 1,
									),
								)
							}
							aria-label={lang.t("Move down")}
						>
							↓
						</Button>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="trash"
							onClick={() =>
								onChange(removeMonsterSpellcastingBlock(draft, blockIndex))
							}
							aria-label={lang.t("Remove spellcasting block")}
						/>
					</div>
				</div>
				<div className="MonsterFieldEditModal__spell_meta_grid">
					<label className="MonsterFieldEditModal__field MonsterFieldEditModal__field_wide">
						<span className="MonsterFieldEditModal__field_label">
							{lang.t("Name")}
						</span>
						<TextInput
							value={name}
							data-parser-target={nameTargetId}
							title={lang.t("Ctrl+K — Insert parsed content")}
							onChange={(event) => updateScalar("name", event.target.value)}
							onKeyDown={(event) =>
								requestParserFromField(
									event,
									nameTargetId,
									name,
									(value) => updateScalar("name", value),
									onOpenParser,
									"action-name",
								)
							}
						/>
					</label>
					<label className="MonsterFieldEditModal__field">
						<span className="MonsterFieldEditModal__field_label">
							{lang.t("Ability")}
						</span>
						<Select
							value={getMonsterSpellcastingScalar(block, "ability")}
							onChange={(event) => updateScalar("ability", event.target.value)}
						>
							{scalarSelectOptions(
								ABILITY_OPTIONS,
								getMonsterSpellcastingScalar(block, "ability"),
							).map((option) => (
								<option key={option || "none"} value={option}>
									{option ? option.toUpperCase() : lang.t("Not specified")}
								</option>
							))}
						</Select>
					</label>
					<label className="MonsterFieldEditModal__field">
						<span className="MonsterFieldEditModal__field_label">
							{lang.t("Display as")}
						</span>
						<Select
							value={getMonsterSpellcastingScalar(block, "displayAs")}
							onChange={(event) => updateScalar("displayAs", event.target.value)}
						>
							{scalarSelectOptions(
								DISPLAY_AS_OPTIONS,
								getMonsterSpellcastingScalar(block, "displayAs"),
							).map((option) => (
								<option key={option || "default"} value={option}>
									{option || lang.t("Default position")}
								</option>
							))}
						</Select>
					</label>
					<label className="MonsterFieldEditModal__field">
						<span className="MonsterFieldEditModal__field_label">
							{lang.t("Block type")}
						</span>
						<TextInput
							value={getMonsterSpellcastingScalar(block, "type")}
							onChange={(event) => updateScalar("type", event.target.value)}
						/>
					</label>
					<label className="MonsterFieldEditModal__field">
						<span className="MonsterFieldEditModal__field_label">
							{lang.t("Charges item")}
						</span>
						<TextInput
							value={getMonsterSpellcastingScalar(block, "chargesItem")}
							placeholder="wand of orcus|dmg"
							onChange={(event) => updateScalar("chargesItem", event.target.value)}
						/>
					</label>
				</div>
				<SpellItemList
					{...props}
					label={RICH_LIST_LABELS.headerEntries}
					target={{ kind: "rich", key: "headerEntries" }}
				/>
				<div className="MonsterFieldEditModal__spell_primary_lists">
					<SpellItemList
						{...props}
						label={RICH_LIST_LABELS.will}
						target={{ kind: "rich", key: "will" }}
					/>
					<SpellcastingBucketEditor {...props} bucket="daily" />
					<LeveledSpellsEditor {...props} />
				</div>
				<details className="MonsterFieldEditModal__spell_advanced">
					<summary>{lang.t("Other casting frequencies and metadata")}</summary>
					<div className="MonsterFieldEditModal__spell_advanced_body">
						{MONSTER_SPELLCASTING_BUCKET_KEYS.filter(
							(key) => key !== "daily",
						).map((bucket) => (
							<SpellcastingBucketEditor
								key={bucket}
								{...props}
								bucket={bucket}
							/>
						))}
						<SpellItemList
							{...props}
							label={RICH_LIST_LABELS.ritual}
							target={{ kind: "rich", key: "ritual" }}
						/>
						<HiddenFieldsEditor
							draft={draft}
							block={block}
							blockIndex={blockIndex}
							onChange={onChange}
						/>
					</div>
				</details>
				<SpellItemList
					{...props}
					label={RICH_LIST_LABELS.footerEntries}
					target={{ kind: "rich", key: "footerEntries" }}
				/>
			</div>
		</details>
	);
}

export default function MonsterSpellcastingSections({
	draft,
	onChange,
	onOpenParser,
}: MonsterSpellcastingSectionsProps) {
	const blocks = getMonsterSpellcastingBlocks(draft);
	return (
		<section className="MonsterFieldEditModal__spellcasting_section">
			<div className="MonsterFieldEditModal__action_header">
				<div>
					<h4>{lang.t("Spellcasting")}</h4>
					<p className="MonsterFieldEditModal__shortcut_hint">
						{lang.t(
							"Press Ctrl+K in any spellcasting text field to open templates and the spell or rules browser.",
						)}
					</p>
				</div>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="plus"
					onClick={() => onChange(addMonsterSpellcastingBlock(draft))}
				>
					{lang.t("Add spellcasting block")}
				</Button>
			</div>
			{blocks.length === 0 ? (
				<div className="MonsterFieldEditModal__empty">
					{lang.t("No spellcasting blocks.")}
				</div>
			) : (
				<div className="MonsterFieldEditModal__spell_blocks">
					{blocks.map((block, blockIndex) => (
						<SpellcastingBlockEditor
							key={`spellcasting-block-${blockIndex}`}
							draft={draft}
							block={block}
							blockCount={blocks.length}
							blockIndex={blockIndex}
							onChange={onChange}
							onOpenParser={onOpenParser}
						/>
					))}
				</div>
			)}
		</section>
	);
}
