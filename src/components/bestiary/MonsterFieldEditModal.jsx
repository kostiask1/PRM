import { useEffect, useState } from "react";

import Modal from "../common/Modal";
import Button from "../form/Button";
import Input from "../form/Input";
import RulesReferenceModalContent from "../modals/RulesReferenceModalContent";
import { lang } from "../../services/localization";
import "../../assets/components/MonsterFieldEditModal.css";

const CREATURE_ACTION_SECTIONS = [
	{ key: "trait", label: "Traits" },
	{ key: "bonus", label: "Bonus Actions" },
	{ key: "action", label: "Actions" },
	{ key: "reaction", label: "Reactions" },
	{ key: "legendary", label: "Legendary Actions" },
];

const SPEED_KEYS = new Set(["walk", "burrow", "climb", "fly", "swim"]);

function cloneMonster(monster) {
	return JSON.parse(JSON.stringify(monster ?? null));
}

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function actionEntriesToText(action = {}) {
	if (Array.isArray(action.entries)) {
		return action.entries
			.map((entry) =>
				typeof entry === "string" ? entry : JSON.stringify(entry, null, 2),
			)
			.join("\n");
	}
	if (Array.isArray(action.desc)) return action.desc.join("\n");
	return String(action.desc || "");
}

function actionFromText(action = {}, text = "") {
	const normalizedText = String(text || "").trim();
	const next = { ...action };
	if (hasOwn(next, "desc") && !hasOwn(next, "entries")) {
		next.desc = normalizedText;
		return next;
	}
	next.entries = normalizedText ? [normalizedText] : [];
	delete next.desc;
	return next;
}

function parseMaybeNumber(value) {
	const text = String(value ?? "").trim();
	if (!text) return undefined;
	const number = Number(text);
	return Number.isFinite(number) ? number : text;
}

function getCreatureAcInput(monster = {}) {
	if (Array.isArray(monster.ac) && monster.ac[0] !== undefined) {
		const entry = monster.ac[0];
		return String(
			typeof entry === "object" ? (entry.ac ?? entry.special ?? "") : entry,
		);
	}
	return String(monster.armor_class ?? "");
}

function getCreatureHpAverageInput(monster = {}) {
	if (monster.hp && typeof monster.hp === "object") {
		return String(monster.hp.average ?? monster.hp.special ?? "");
	}
	return String(monster.hit_points ?? "");
}

function getCreatureHpFormulaInput(monster = {}) {
	if (monster.hp && typeof monster.hp === "object") {
		return String(monster.hp.formula ?? "");
	}
	return String(monster.hit_dice ?? "");
}

function listLikeValueToText(value) {
	if (Array.isArray(value)) {
		return value
			.map((entry) =>
				typeof entry === "string" || typeof entry === "number"
					? String(entry)
					: JSON.stringify(entry),
			)
			.join(", ");
	}
	if (value && typeof value === "object") return JSON.stringify(value);
	return String(value ?? "");
}

function splitListText(value) {
	return String(value || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function formatSpeedValue(key, value) {
	const label = key === "walk" ? "" : `${key} `;
	if (value && typeof value === "object") {
		const number = value.number ?? "";
		const condition = value.condition ? ` ${value.condition}` : "";
		return `${label}${number} ft.${condition}`.trim();
	}
	return `${label}${value} ft.`.trim();
}

function speedToText(speed) {
	if (typeof speed === "string") return speed;
	if (!speed || typeof speed !== "object" || Array.isArray(speed)) return "";

	const parts = Object.entries(speed)
		.filter(([key, value]) => SPEED_KEYS.has(key) && value !== false)
		.map(([key, value]) => formatSpeedValue(key, value))
		.filter(Boolean);

	if (speed.canHover && !parts.join(" ").toLowerCase().includes("hover")) {
		const flyIndex = parts.findIndex((part) => /^fly\b/i.test(part));
		if (flyIndex >= 0) parts[flyIndex] = `${parts[flyIndex]} (hover)`;
		else parts.push("hover");
	}

	return parts.join(", ");
}

function parseSpeedText(value) {
	const text = String(value || "").trim();
	if (!text) return "";
	if (text.startsWith("{")) {
		try {
			const parsed = JSON.parse(text);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed;
			}
		} catch {
			return text;
		}
	}

	const result = {};
	let parsedAny = false;
	let canHover = /\bhover\b/i.test(text);
	const parts = text
		.split(/[,\n]/)
		.map((part) => part.trim())
		.filter(Boolean);

	parts.forEach((part) => {
		if (/^hover$/i.test(part)) {
			canHover = true;
			return;
		}
		const match = part.match(
			/^(?:(walk|burrow|climb|fly|swim)\s+)?(\d+)\s*(?:ft\.?|feet)?\s*(.*)$/i,
		);
		if (!match) return;

		const key = (match[1] || "walk").toLowerCase();
		const number = Number(match[2]);
		const condition = String(match[3] || "")
			.replace(/\(?\bhover\b\)?/gi, "")
			.trim();
		result[key] = condition ? { number, condition } : number;
		parsedAny = true;
	});

	if (!parsedAny) return text;
	if (canHover) result.canHover = true;
	return result;
}

function getCreatureEditableFieldInput(monster = {}, key) {
	if (key === "ac") return getCreatureAcInput(monster);
	if (key === "hpAverage") return getCreatureHpAverageInput(monster);
	if (key === "hpFormula") return getCreatureHpFormulaInput(monster);
	if (key === "speed") return speedToText(monster.speed);
	if (key === "desc" && Array.isArray(monster.desc)) {
		return monster.desc
			.map((entry) =>
				typeof entry === "string" ? entry : JSON.stringify(entry),
			)
			.join("\n");
	}
	if (key === "type" && monster.type && typeof monster.type === "object") {
		return String(monster.type.type || "");
	}
	return listLikeValueToText(monster[key]);
}

function updateCreatureBasicField(monster, key, value) {
	const next = { ...monster };
	if (key === "ac") {
		next.ac = [parseMaybeNumber(value) ?? ""];
		next.armor_class = parseMaybeNumber(value) ?? "";
		return next;
	}
	if (key === "hpAverage") {
		const parsed = parseMaybeNumber(value);
		next.hp = {
			...(next.hp && typeof next.hp === "object" ? next.hp : {}),
			average: parsed ?? "",
		};
		next.hit_points = parsed ?? "";
		return next;
	}
	if (key === "hpFormula") {
		next.hp = {
			...(next.hp && typeof next.hp === "object" ? next.hp : {}),
			formula: value,
		};
		next.hit_dice = value;
		return next;
	}
	if (key === "cr") {
		next.cr = value;
		return next;
	}
	if (key === "speed") {
		next.speed = parseSpeedText(value);
		return next;
	}
	if (
		key === "size" ||
		key === "alignment" ||
		key === "senses" ||
		key === "languages"
	) {
		next[key] = Array.isArray(monster?.[key]) ? splitListText(value) : value;
		return next;
	}
	if (key === "type") {
		next.type =
			monster?.type &&
			typeof monster.type === "object" &&
			!Array.isArray(monster.type)
				? { ...monster.type, type: value }
				: value;
		return next;
	}
	if (key === "desc") {
		next.desc = Array.isArray(monster?.desc)
			? String(value || "").trim()
				? [value]
				: []
			: value;
		return next;
	}
	if (["str", "dex", "con", "int", "wis", "cha"].includes(key)) {
		next[key] = parseMaybeNumber(value) ?? "";
		return next;
	}
	next[key] = value;
	return next;
}

export default function MonsterFieldEditModal({
	editingMonster,
	title = lang.t("Edit creature"),
	onCancel,
	onSave,
}) {
	const [draft, setDraft] = useState(null);
	const [jsonText, setJsonText] = useState("");
	const [editMode, setEditMode] = useState("fields");
	const [error, setError] = useState("");
	const [ruleInsertTarget, setRuleInsertTarget] = useState(null);

	useEffect(() => {
		const nextDraft = editingMonster ? cloneMonster(editingMonster) : null;
		setDraft(nextDraft);
		setJsonText(nextDraft ? JSON.stringify(nextDraft, null, 2) : "");
		setEditMode("fields");
		setError("");
		setRuleInsertTarget(null);
	}, [editingMonster]);

	if (!editingMonster || !draft) return null;

	const updateDraft = (updater) => {
		setDraft((current) => {
			const next =
				typeof updater === "function" ? updater(current || {}) : updater;
			setJsonText(JSON.stringify(next || {}, null, 2));
			return next;
		});
	};

	const switchEditMode = (nextMode) => {
		if (nextMode === editMode) return;
		if (nextMode === "fields") {
			try {
				const parsed = JSON.parse(jsonText);
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
					setError(lang.t("Monster data must be a JSON object."));
					return;
				}
				setDraft(parsed);
				setError("");
				setEditMode("fields");
			} catch (err) {
				setError(err.message || lang.t("Invalid JSON."));
			}
			return;
		}
		setJsonText(JSON.stringify(draft || {}, null, 2));
		setError("");
		setEditMode("json");
	};

	const updateAction = (section, index, updater) => {
		updateDraft((current) => {
			const list = Array.isArray(current?.[section]) ? current[section] : [];
			return {
				...current,
				[section]: list.map((action, actionIndex) =>
					actionIndex === index ? updater(action || {}) : action,
				),
			};
		});
	};

	const addAction = (section) => {
		updateDraft((current) => {
			const list = Array.isArray(current?.[section]) ? current[section] : [];
			return {
				...current,
				[section]: [...list, { name: "", entries: [""] }],
			};
		});
	};

	const removeAction = (section, index) => {
		updateDraft((current) => {
			const list = Array.isArray(current?.[section]) ? current[section] : [];
			return {
				...current,
				[section]: list.filter((_, actionIndex) => actionIndex !== index),
			};
		});
	};

	const openRuleInsertPicker = (event, target) => {
		const key = String(event.key || "").toLowerCase();
		const isMod = event.ctrlKey || event.metaKey;
		if (!isMod || (key !== "k" && key !== "л")) return;
		event.preventDefault();
		event.stopPropagation();
		const node = event.currentTarget;
		setRuleInsertTarget({
			...target,
			selectionStart: node.selectionStart ?? String(node.value || "").length,
			selectionEnd:
				node.selectionEnd ??
				node.selectionStart ??
				String(node.value || "").length,
		});
	};

	const getRuleInsertValue = (target) => {
		if (!target) return "";
		if (target.type === "field") {
			return getCreatureEditableFieldInput(draft, target.key);
		}
		if (target.type === "action") {
			const action = draft[target.section]?.[target.index] || {};
			return actionEntriesToText(action);
		}
		return "";
	};

	const applyRuleInsert = ({ tag }) => {
		if (!ruleInsertTarget || !tag) {
			setRuleInsertTarget(null);
			return;
		}
		const currentValue = getRuleInsertValue(ruleInsertTarget);
		const start = Math.max(0, ruleInsertTarget.selectionStart || 0);
		const end = Math.max(start, ruleInsertTarget.selectionEnd || start);
		const nextValue =
			currentValue.slice(0, start) + tag + currentValue.slice(end);

		if (ruleInsertTarget.type === "field") {
			updateDraft((current) =>
				updateCreatureBasicField(
					current || {},
					ruleInsertTarget.key,
					nextValue,
				),
			);
		} else if (ruleInsertTarget.type === "action") {
			updateAction(ruleInsertTarget.section, ruleInsertTarget.index, (action) =>
				actionFromText(action, nextValue),
			);
		}
		setRuleInsertTarget(null);
	};

	const saveDraft = () => {
		setError("");
		let nextDraft = draft;
		if (editMode === "json") {
			try {
				nextDraft = JSON.parse(jsonText);
			} catch (err) {
				setError(err.message || lang.t("Invalid JSON."));
				return;
			}
			if (
				!nextDraft ||
				typeof nextDraft !== "object" ||
				Array.isArray(nextDraft)
			) {
				setError(lang.t("Monster data must be a JSON object."));
				return;
			}
		}
		if (!String(nextDraft.name || "").trim()) {
			setError(lang.t("Name is required to create an entry."));
			return;
		}
		try {
			onSave?.(cloneMonster(nextDraft));
		} catch (err) {
			setError(err.message || lang.t("Unknown error"));
		}
	};

	const renderInputField = (key, label, options = {}) => (
		<label key={key} className="MonsterFieldEditModal__field">
			<span>{lang.t(label)}</span>
			<Input
				type={options.type || "text"}
				value={getCreatureEditableFieldInput(draft, key)}
				onChange={(event) =>
					updateDraft((current) =>
						updateCreatureBasicField(current || {}, key, event.target.value),
					)
				}
			/>
		</label>
	);

	const renderTextField = (key, label, rows = 3) => (
		<label key={key} className="MonsterFieldEditModal__field">
			<span>{lang.t(label)}</span>
			<textarea
				className="Input Input__textarea MonsterFieldEditModal__textarea"
				rows={rows}
				value={getCreatureEditableFieldInput(draft, key)}
				onChange={(event) =>
					updateDraft((current) =>
						updateCreatureBasicField(current || {}, key, event.target.value),
					)
				}
				onKeyDown={(event) =>
					openRuleInsertPicker(event, { type: "field", key })
				}
				title={lang.t("Ctrl+K — Insert rule reference")}
			/>
		</label>
	);

	const renderActionSection = (section) => {
		const list = Array.isArray(draft?.[section.key]) ? draft[section.key] : [];
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
						onClick={() => addAction(section.key)}
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
												updateAction(section.key, index, (currentAction) => ({
													...currentAction,
													name: event.target.value,
												}))
											}
										/>
									</label>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="trash"
										onClick={() => removeAction(section.key, index)}
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
											updateAction(section.key, index, (currentAction) =>
												actionFromText(currentAction, event.target.value),
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
								{renderInputField("source", "Source")}
								{renderInputField("size", "Size")}
								{renderInputField("type", "Type")}
								{renderInputField("alignment", "Alignment")}
								{renderInputField("ac", "Armor Class")}
								{renderInputField("hpAverage", "Hit Points")}
								{renderInputField("hpFormula", "HP Formula")}
								{renderInputField("cr", "Challenge Rating")}
							</div>
							<div className="MonsterFieldEditModal__fields MonsterFieldEditModal__abilities">
								{["str", "dex", "con", "int", "wis", "cha"].map((ability) =>
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
								try {
									const parsed = JSON.parse(text);
									if (
										parsed &&
										typeof parsed === "object" &&
										!Array.isArray(parsed)
									) {
										setDraft(parsed);
										setError("");
									}
								} catch {
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
			{ruleInsertTarget && (
				<Modal
					title={lang.t("Rules Reference")}
					onCancel={() => setRuleInsertTarget(null)}
					showFooter={false}
					type="custom"
					className="MonsterFieldEditModal__rules_modal"
					overlayClassName="MonsterFieldEditModal__rules_overlay"
				>
					<RulesReferenceModalContent onSelectReference={applyRuleInsert} />
				</Modal>
			)}
		</>
	);
}
