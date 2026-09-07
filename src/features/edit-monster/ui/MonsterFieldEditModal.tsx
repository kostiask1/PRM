import {
	type ChangeEvent,
	type ComponentType,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";

import type {
	MonsterData,
	MonsterEntry,
} from "../../../entities/bestiary/index.js";
import {
	formatModifier,
	getAbilityModifier,
} from "../../../entities/reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	Button,
	Modal,
	Select,
	TextInput,
} from "../../../shared/ui/index.js";
import {
	ALIGNMENT_OPTIONS,
	CREATURE_ABILITY_KEYS,
	SIZE_OPTIONS,
	actionFromText,
	addMonsterAction,
	applyRuleReferenceTag,
	cloneMonster,
	getCreatureEditableFieldInput,
	getCreatureSelectValue,
	isRulesReferenceShortcut,
	parseMonsterJson,
	prepareMonsterDraftForSave,
	removeMonsterAction,
	updateCreatureBasicField,
	updateMonsterAction,
	type CreatureActionSection,
	type CreatureAbilityKey,
	type CreatureEditableFieldKey,
	type MonsterEditMode,
	type NamedMonsterData,
	type RuleInsertTarget,
	type RuleReferenceSelection,
} from "../model.ts";
import MonsterActionSections from "./MonsterActionSections.tsx";
import MonsterFieldSections from "./MonsterFieldSections.tsx";
import MonsterTextParsingHelp from "./MonsterTextParsingHelp.tsx";
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
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [ruleInsertTarget, setRuleInsertTarget] =
		useState<RuleInsertTarget | null>(null);
	const parsingHelpId = useId();

	useEffect(() => {
		const nextDraft = editingMonster ? cloneMonster(editingMonster) : null;
		setDraft(nextDraft);
		setJsonText(nextDraft ? JSON.stringify(nextDraft, null, 2) : "");
		setEditMode("fields");
		setError("");
		setIsHelpOpen(false);
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
	const addAction = (section: CreatureActionSection) => {
		updateDraft((current) => addMonsterAction(current, section));
	};
	const removeAction = (section: CreatureActionSection, index: number) => {
		updateDraft((current) => removeMonsterAction(current, section, index));
	};
	const updateActionName = (
		event: ChangeEvent<HTMLInputElement>,
		section: CreatureActionSection,
		index: number,
	) => {
		updateAction(section, index, (currentAction) => ({
			...currentAction,
			name: event.target.value,
		}));
	};
	const updateActionText = (
		event: ChangeEvent<HTMLTextAreaElement>,
		section: CreatureActionSection,
		index: number,
	) => {
		updateAction(section, index, (currentAction) =>
			actionFromText(currentAction, event.target.value),
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
	const openActionRuleInsertPicker = (
		event: KeyboardEvent<HTMLTextAreaElement>,
		section: CreatureActionSection,
		index: number,
	) => {
		openRuleInsertPicker(event, { type: "action", section, index });
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

	const toggleParsingHelp = () => {
		setIsHelpOpen((current) => !current);
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
			<span className="MonsterFieldEditModal__field_label">
				{lang.t(label)}
			</span>
			<TextInput
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
				<span className="MonsterFieldEditModal__field_label">
					{lang.t(label)}
				</span>
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
			<span className="MonsterFieldEditModal__field_label">
				{lang.t(label)}
			</span>
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

	const renderAbilityField = (ability: CreatureAbilityKey) => {
		const value = getCreatureEditableFieldInput(draft, ability);
		const parsedScore = Number.parseInt(value, 10);
		const modifier =
			value.trim() && !Number.isNaN(parsedScore)
				? formatModifier(getAbilityModifier(parsedScore))
				: "—";

		return (
			<label
				key={ability}
				className="MonsterFieldEditModal__ability_field"
			>
				<span className="MonsterFieldEditModal__ability_label">
					{ability.toUpperCase()}
				</span>
				<span className="MonsterFieldEditModal__ability_modifier">
					{modifier}
				</span>
				<TextInput
					type="number"
					className="MonsterFieldEditModal__ability_input"
					aria-label={ability.toUpperCase()}
					value={value}
					onChange={(event) =>
						updateDraft((current) =>
							updateCreatureBasicField(
								current,
								ability,
								event.target.value,
							),
						)
					}
				/>
			</label>
		);
	};

	return (
		<>
			<Modal
				title={title}
				headerActions={
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="help"
						className={`MonsterFieldEditModal__help_button${isHelpOpen ? " is_active" : ""}`}
						title={lang.t(
							isHelpOpen ? "Hide text parsing help" : "Show text parsing help",
						)}
						aria-label={lang.t(
							isHelpOpen ? "Hide text parsing help" : "Show text parsing help",
						)}
						aria-controls={parsingHelpId}
						aria-expanded={isHelpOpen}
						onClick={toggleParsingHelp}
					/>
				}
				onConfirm={() => {}}
				onCancel={onCancel}
				showFooter={false}
				className="MonsterFieldEditModal__modal"
				overlayClassName="MonsterFieldEditModal__overlay"
			>
				<div className="MonsterFieldEditModal">
					{isHelpOpen ? (
						<>
							<MonsterTextParsingHelp id={parsingHelpId} />
							<div className="MonsterFieldEditModal__footer">
								<Button variant="primary" onClick={() => setIsHelpOpen(false)}>
									{lang.t("Back to creature editing")}
								</Button>
							</div>
						</>
					) : (
						<>
							{error && (
								<div className="MonsterFieldEditModal__error">{error}</div>
							)}
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
								<MonsterFieldSections
									nameField={renderInputField("name", "Name")}
									metaFields={
										<>
											{renderSelectField("size", "Size", SIZE_OPTIONS)}
											{renderInputField("type", "Type")}
											{renderSelectField(
												"alignment",
												"Alignment",
												ALIGNMENT_OPTIONS,
											)}
										</>
									}
									sourceField={renderInputField("source", "Source", {
										disabled: true,
									})}
									statFields={
										<>
											{renderInputField("hpFormula", "HP Formula")}
											{renderInputField("ac", "Armor Class")}
											{renderTextField("speed", "Speed", 2)}
										</>
									}
									defenseFields={
										<>
											{renderTextField(
												"vulnerable",
												"Damage Vulnerabilities",
												2,
											)}
											{renderTextField(
												"resist",
												"Damage Resistances",
												2,
											)}
											{renderTextField(
												"immune",
												"Damage Immunities",
												2,
											)}
											{renderTextField(
												"conditionImmune",
												"Condition Immunities",
												2,
											)}
										</>
									}
									descriptionFields={
										<>
											{renderTextField("senses", "Senses", 2)}
											{renderTextField("languages", "Languages", 2)}
											{renderInputField("cr", "Challenge Rating")}
										</>
									}
									loreField={renderTextField("desc", "Description", 4)}
									abilityFields={CREATURE_ABILITY_KEYS.map(
										renderAbilityField,
									)}
									actionSections={
										<MonsterActionSections
											draft={draft}
											onAddAction={addAction}
											onActionNameChange={updateActionName}
											onActionTextChange={updateActionText}
											onActionTextKeyDown={openActionRuleInsertPicker}
											onRemoveAction={removeAction}
										/>
									}
								/>
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
						</>
					)}
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
