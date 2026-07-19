import {
	type ComponentType,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useState,
} from "react";

import type {
	MonsterData,
	MonsterEntry,
} from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, Select } from "../../../shared/ui/index.js";
import { Input } from "../../editor/ui/index.js";
import { Modal } from "../../modal/index.js";
import {
	ALIGNMENT_OPTIONS,
	CREATURE_ABILITY_KEYS,
	CREATURE_ACTION_SECTIONS,
	SIZE_OPTIONS,
	actionEntriesToText,
	actionFromText,
	addMonsterAction,
	applyRuleReferenceTag,
	cloneMonster,
	getCreatureEditableFieldInput,
	getCreatureSelectValue,
	getMonsterActionList,
	isRulesReferenceShortcut,
	parseMonsterJson,
	prepareMonsterDraftForSave,
	removeMonsterAction,
	updateCreatureBasicField,
	updateMonsterAction,
	type CreatureActionSection,
	type CreatureEditableFieldKey,
	type MonsterEditMode,
	type NamedMonsterData,
	type RuleInsertTarget,
	type RuleReferenceSelection,
} from "../model.ts";
import "../../../assets/components/MonsterFieldEditModal.css";

interface RulesReferenceContentProps {
	onSelectReference: (selection: RuleReferenceSelection) => void;
}

export interface MonsterFieldEditModalProps {
	editingMonster?: MonsterData | null;
	title?: ReactNode;
	onCancel: () => void;
	onSave?: (monster: NamedMonsterData) => void | Promise<void>;
	RulesReferenceContent?: ComponentType<RulesReferenceContentProps> | null;
}

interface InputFieldOptions {
	type?: "text" | "number";
	disabled?: boolean;
}

interface SelectFieldOption {
	value: string;
	label: string;
}

type RuleInsertTargetInput =
	| { type: "field"; key: CreatureEditableFieldKey }
	| { type: "action"; section: CreatureActionSection; index: number };

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export default function MonsterFieldEditModal({
	editingMonster,
	title = lang.t("Edit creature"),
	onCancel,
	onSave,
	RulesReferenceContent = null,
}: MonsterFieldEditModalProps) {
	const [draft, setDraft] = useState<MonsterData | null>(null);
	const [jsonText, setJsonText] = useState("");
	const [editMode, setEditMode] = useState<MonsterEditMode>("fields");
	const [error, setError] = useState("");
	const [ruleInsertTarget, setRuleInsertTarget] =
		useState<RuleInsertTarget | null>(null);

	useEffect(() => {
		const nextDraft = editingMonster ? cloneMonster(editingMonster) : null;
		setDraft(nextDraft);
		setJsonText(nextDraft ? JSON.stringify(nextDraft, null, 2) : "");
		setEditMode("fields");
		setError("");
		setRuleInsertTarget(null);
	}, [editingMonster]);

	if (!editingMonster || !draft) return null;

	const updateDraft = (
		updater: MonsterData | ((current: MonsterData) => MonsterData),
	) => {
		setDraft((current) => {
			const next =
				typeof updater === "function"
					? updater(current || {})
					: updater;
			setJsonText(JSON.stringify(next || {}, null, 2));
			return next;
		});
	};

	const switchEditMode = (nextMode: MonsterEditMode) => {
		if (nextMode === editMode) return;
		if (nextMode === "fields") {
			const parsed = parseMonsterJson(jsonText);
			if (!parsed.ok) {
				setError(
					parsed.reason === "not-object"
						? lang.t("Monster data must be a JSON object.")
						: parsed.message || lang.t("Invalid JSON."),
				);
				return;
			}
			setDraft(parsed.monster);
			setError("");
			setEditMode("fields");
			return;
		}
		setJsonText(JSON.stringify(draft || {}, null, 2));
		setError("");
		setEditMode("json");
	};

	const updateAction = (
		section: CreatureActionSection,
		index: number,
		updater: (action: MonsterEntry) => MonsterEntry,
	) => {
		updateDraft((current) =>
			updateMonsterAction(current, section, index, updater),
		);
	};

	const openRuleInsertPicker = (
		event: KeyboardEvent<HTMLTextAreaElement>,
		target: RuleInsertTargetInput,
	) => {
		if (!isRulesReferenceShortcut(event)) return;
		event.preventDefault();
		event.stopPropagation();
		const node = event.currentTarget;
		setRuleInsertTarget({
			...target,
			selectionStart: node.selectionStart ?? node.value.length,
			selectionEnd:
				node.selectionEnd ?? node.selectionStart ?? node.value.length,
		});
	};

	const applyRuleInsert = ({ tag }: RuleReferenceSelection) => {
		if (!ruleInsertTarget || !tag) {
			setRuleInsertTarget(null);
			return;
		}
		updateDraft((current) =>
			applyRuleReferenceTag(current, ruleInsertTarget, tag),
		);
		setRuleInsertTarget(null);
	};

	const saveDraft = () => {
		setError("");
		const result = prepareMonsterDraftForSave({
			draft,
			jsonText,
			editMode,
			source: editingMonster.source,
		});
		if (!result.ok) {
			if (result.reason === "not-object") {
				setError(lang.t("Monster data must be a JSON object."));
			} else if (result.reason === "missing-name") {
				setError(lang.t("Name is required to create an entry."));
			} else {
				setError(result.message || lang.t("Invalid JSON."));
			}
			return;
		}
		try {
			const savedMonster = cloneMonster(result.monster);
			if (savedMonster) onSave?.(savedMonster);
		} catch (saveError) {
			setError(getErrorMessage(saveError, lang.t("Unknown error")));
		}
	};

	const renderInputField = (
		key: CreatureEditableFieldKey,
		label: string,
		options: InputFieldOptions = {},
	) => (
		<label
			key={key}
			className={`MonsterFieldEditModal__field${options.disabled ? " is_disabled" : ""}`}
		>
			<span>{lang.t(label)}</span>
			<Input
				type={options.type || "text"}
				disabled={options.disabled}
				value={getCreatureEditableFieldInput(draft, key)}
				onChange={(event) =>
					updateDraft((current) =>
						updateCreatureBasicField(current, key, event.target.value),
					)
				}
			/>
		</label>
	);

	const renderSelectField = (
		key: "size" | "alignment",
		label: string,
		options: readonly SelectFieldOption[],
	) => {
		const currentValue = getCreatureSelectValue(draft, key);
		const fullOptions = options.some((option) => option.value === currentValue)
			? options
			: [
					...options,
					{
						value: currentValue,
						label: currentValue || lang.t("Custom"),
					},
				];

		return (
			<label key={key} className="MonsterFieldEditModal__field">
				<span>{lang.t(label)}</span>
				<Select
					value={currentValue}
					onChange={(event) =>
						updateDraft((current) =>
							updateCreatureBasicField(current, key, event.target.value),
						)
					}
				>
					{fullOptions.map((option) => (
						<option key={option.value} value={option.value}>
							{lang.t(option.label)}
						</option>
					))}
				</Select>
			</label>
		);
	};

	const renderTextField = (
		key: CreatureEditableFieldKey,
		label: string,
		rows = 3,
	) => (
		<label key={key} className="MonsterFieldEditModal__field">
			<span>{lang.t(label)}</span>
			<textarea
				className="Input Input__textarea MonsterFieldEditModal__textarea"
				rows={rows}
				value={getCreatureEditableFieldInput(draft, key)}
				onChange={(event) =>
					updateDraft((current) =>
						updateCreatureBasicField(current, key, event.target.value),
					)
				}
				onKeyDown={(event) =>
					openRuleInsertPicker(event, { type: "field", key })
				}
				title={lang.t("Ctrl+K — Insert rule reference")}
			/>
		</label>
	);

	const renderActionSection = (
		section: (typeof CREATURE_ACTION_SECTIONS)[number],
	) => {
		const list = getMonsterActionList(draft, section.key);
		return (
			<section
				key={section.key}
				className="MonsterFieldEditModal__action_section"
			>
				<div className="MonsterFieldEditModal__action_header">
					<h4>{lang.t(section.label)}</h4>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="plus"
						onClick={() =>
							updateDraft((current) =>
								addMonsterAction(current, section.key),
							)
						}
					>
						{lang.t("Add action")}
					</Button>
				</div>
				{list.length === 0 ? (
					<div className="MonsterFieldEditModal__empty">
						{lang.t("No entries.")}
					</div>
				) : (
					<div className="MonsterFieldEditModal__action_list">
						{list.map((action, index) => (
							<div
								key={`${section.key}-${index}`}
								className="MonsterFieldEditModal__action_item"
							>
								<div className="MonsterFieldEditModal__action_title">
									<label className="MonsterFieldEditModal__field">
										<span>{lang.t("Name")}</span>
										<Input
											value={String(action?.name || "")}
											onChange={(event) =>
												updateAction(
													section.key,
													index,
													(currentAction) => ({
														...currentAction,
														name: event.target.value,
													}),
												)
											}
										/>
									</label>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="trash"
										onClick={() =>
											updateDraft((current) =>
												removeMonsterAction(
													current,
													section.key,
													index,
												),
											)
										}
										title={lang.t("Remove action")}
									/>
								</div>
								<label className="MonsterFieldEditModal__field">
									<span>{lang.t("Text")}</span>
									<textarea
										className="Input Input__textarea MonsterFieldEditModal__textarea"
										rows={4}
										value={actionEntriesToText(action)}
										onChange={(event) =>
											updateAction(
												section.key,
												index,
												(currentAction) =>
													actionFromText(
														currentAction,
														event.target.value,
													),
											)
										}
										onKeyDown={(event) =>
											openRuleInsertPicker(event, {
												type: "action",
												section: section.key,
												index,
											})
										}
										title={lang.t("Ctrl+K — Insert rule reference")}
									/>
								</label>
							</div>
						))}
					</div>
				)}
			</section>
		);
	};

	return (
		<>
			<Modal
				title={title}
				onConfirm={() => {}}
				onCancel={onCancel}
				showFooter={false}
				className="MonsterFieldEditModal__modal"
				overlayClassName="MonsterFieldEditModal__overlay"
			>
				<div className="MonsterFieldEditModal">
					{error && <div className="MonsterFieldEditModal__error">{error}</div>}
					<div className="MonsterFieldEditModal__mode_switch">
						<Button
							variant={editMode === "fields" ? "primary" : "ghost"}
							size={Button.SIZES.SMALL}
							onClick={() => switchEditMode("fields")}
						>
							{lang.t("Fields")}
						</Button>
						<Button
							variant={editMode === "json" ? "primary" : "ghost"}
							size={Button.SIZES.SMALL}
							onClick={() => switchEditMode("json")}
						>
							JSON
						</Button>
					</div>
					{editMode === "fields" ? (
						<>
							<div className="MonsterFieldEditModal__fields">
								{renderInputField("name", "Name")}
								{renderInputField("source", "Source", { disabled: true })}
								{renderSelectField("size", "Size", SIZE_OPTIONS)}
								{renderInputField("type", "Type")}
								{renderSelectField(
									"alignment",
									"Alignment",
									ALIGNMENT_OPTIONS,
								)}
								{renderInputField("ac", "Armor Class")}
								{renderInputField("hpFormula", "HP Formula")}
								{renderInputField("cr", "Challenge Rating")}
							</div>
							<div className="MonsterFieldEditModal__fields MonsterFieldEditModal__abilities">
								{CREATURE_ABILITY_KEYS.map((ability) =>
									renderInputField(ability, ability.toUpperCase(), {
										type: "number",
									}),
								)}
							</div>
							<div className="MonsterFieldEditModal__text_fields">
								{renderTextField("speed", "Speed", 2)}
								{renderTextField("senses", "Senses", 2)}
								{renderTextField("languages", "Languages", 2)}
								{renderTextField("desc", "Description", 4)}
							</div>
							<div className="MonsterFieldEditModal__actions">
								{CREATURE_ACTION_SECTIONS.map(renderActionSection)}
							</div>
						</>
					) : (
						<textarea
							className="Input Input__textarea MonsterFieldEditModal__json"
							value={jsonText}
							onChange={(event) => {
								const text = event.target.value;
								setJsonText(text);
								const parsed = parseMonsterJson(text);
								if (parsed.ok) {
									setDraft(parsed.monster);
									setError("");
								} else if (parsed.reason === "invalid-json") {
									setError(lang.t("Invalid JSON."));
								}
							}}
						/>
					)}
					<div className="MonsterFieldEditModal__footer">
						<Button variant="ghost" onClick={onCancel}>
							{lang.t("Cancel")}
						</Button>
						<Button variant="primary" onClick={saveDraft}>
							{lang.t("Save")}
						</Button>
					</div>
				</div>
			</Modal>
			{ruleInsertTarget && RulesReferenceContent && (
				<Modal
					title={lang.t("Rules Reference")}
					onConfirm={() => {}}
					onCancel={() => setRuleInsertTarget(null)}
					showFooter={false}
					type="custom"
					className="MonsterFieldEditModal__rules_modal"
					overlayClassName="MonsterFieldEditModal__rules_overlay"
				>
					<RulesReferenceContent onSelectReference={applyRuleInsert} />
				</Modal>
			)}
		</>
	);
}
