import { useState } from "react";

import type { MonsterData } from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, TextInput } from "../../../shared/ui/index.js";
import MonsterJsonValueInput from "./MonsterJsonValueInput.tsx";

interface MonsterExactDataSectionProps {
	draft: MonsterData;
	onChange: (monster: MonsterData) => void;
}

const EXACT_FIELD_ORDER = [
	"size",
	"type",
	"alignment",
	"ac",
	"hp",
	"speed",
	"cr",
	"save",
	"skill",
	"languages",
	"senses",
	"vulnerable",
	"resist",
	"immune",
	"conditionImmune",
	"trait",
	"bonus",
	"action",
	"reaction",
	"legendary",
	"legendaryGroup",
	"spellcasting",
	"desc",
	"spell_list",
	"lairActions",
	"regionalEffects",
] as const;

const FRIENDLY_SCALAR_FIELDS = new Set([
	"name",
	"source",
	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha",
]);

const ARRAY_EXACT_FIELDS = new Set([
	"size",
	"alignment",
	"ac",
	"languages",
	"senses",
	"vulnerable",
	"resist",
	"immune",
	"conditionImmune",
	"trait",
	"bonus",
	"action",
	"reaction",
	"legendary",
	"spellcasting",
	"spell_list",
	"lairActions",
	"regionalEffects",
]);

const OBJECT_EXACT_FIELDS = new Set([
	"type",
	"hp",
	"speed",
	"cr",
	"save",
	"skill",
	"legendaryGroup",
]);

function getInitialExactFieldValue(field: string): unknown {
	if (ARRAY_EXACT_FIELDS.has(field)) return [];
	if (OBJECT_EXACT_FIELDS.has(field)) return {};
	return null;
}

function getExactFieldKeys(draft: MonsterData): string[] {
	const ordered = EXACT_FIELD_ORDER.filter((key) => key in draft);
	const known = new Set<string>([...EXACT_FIELD_ORDER, ...FRIENDLY_SCALAR_FIELDS]);
	const extra = Object.keys(draft)
		.filter((key) => !known.has(key))
		.sort((left, right) => left.localeCompare(right));
	return [...ordered, ...extra];
}

export default function MonsterExactDataSection({
	draft,
	onChange,
}: MonsterExactDataSectionProps) {
	const [newFieldName, setNewFieldName] = useState("");
	const fields = getExactFieldKeys(draft);
	const normalizedNewFieldName = newFieldName.trim();
	const canAddField = Boolean(
		normalizedNewFieldName &&
			!(normalizedNewFieldName in draft) &&
			!FRIENDLY_SCALAR_FIELDS.has(normalizedNewFieldName),
	);
	const addField = () => {
		if (!canAddField) return;
		onChange({
			...draft,
			[normalizedNewFieldName]: getInitialExactFieldValue(
				normalizedNewFieldName,
			),
		});
		setNewFieldName("");
	};
	return (
		<details className="MonsterFieldEditModal__exact_data">
			<summary>{lang.t("Exact structured data")}</summary>
			<div className="MonsterFieldEditModal__exact_data_body">
				<p className="MonsterFieldEditModal__shortcut_hint">
					{lang.t(
						"These per-field JSON controls expose every nested or uncommon value without leaving Fields mode. Use them for alternate sizes, complex armor, movement, defenses, rich entries, or imported custom properties. You can also add a missing known or custom field by name.",
					)}
				</p>
				<div className="MonsterFieldEditModal__exact_add_field">
					<TextInput
						value={newFieldName}
						placeholder={lang.t("Field name")}
						aria-label={lang.t("Field name")}
						onChange={(event) => setNewFieldName(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								addField();
							}
						}}
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="plus"
						disabled={!canAddField}
						onClick={addField}
					>
						{lang.t("Add structured field")}
					</Button>
				</div>
				{fields.map((field) => (
					<details key={field} className="MonsterFieldEditModal__exact_field">
						<summary>
							<code>{field}</code>
						</summary>
						<div className="MonsterFieldEditModal__exact_field_body">
							<MonsterJsonValueInput
								ariaLabel={lang.t("Exact JSON value for {field}", { field })}
								rows={Math.min(
									14,
									Math.max(
										4,
										JSON.stringify(draft[field], null, 2)?.split("\n").length || 4,
									),
								)}
								value={draft[field]}
								onChange={(value) => onChange({ ...draft, [field]: value })}
							/>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="trash"
								onClick={() => {
									const next = { ...draft };
									delete next[field];
									onChange(next);
								}}
							>
								{lang.t("Remove field")}
							</Button>
						</div>
					</details>
				))}
			</div>
		</details>
	);
}
