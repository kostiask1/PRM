import { type ChangeEvent, useEffect, useState } from "react";

import type { MonsterData } from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, TextInput } from "../../../shared/ui/index.js";
import {
	addMonsterModifierEntry,
	getMonsterModifierEntries,
	removeMonsterModifierEntry,
	updateMonsterModifierEntry,
	type CreatureModifierField,
} from "../model.ts";

interface MonsterModifierSectionsProps {
	draft: MonsterData;
	onChange: (monster: MonsterData) => void;
}

const MODIFIER_SECTIONS = [
	{ field: "save", label: "Saving Throws", addLabel: "Add saving throw" },
	{ field: "skill", label: "Skills", addLabel: "Add skill" },
] as const;

function ModifierKeyInput({
	value,
	placeholder,
	onCommit,
}: {
	value: string;
	placeholder: string;
	onCommit: (value: string) => void;
}) {
	const [draftValue, setDraftValue] = useState(value);
	useEffect(() => setDraftValue(value), [value]);
	return (
		<TextInput
			value={draftValue}
			aria-label={lang.t("Key")}
			placeholder={placeholder}
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

export default function MonsterModifierSections({
	draft,
	onChange,
}: MonsterModifierSectionsProps) {
	const updateEntryValue = (
		field: CreatureModifierField,
		index: number,
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const entries = getMonsterModifierEntries(draft, field);
		const current = entries[index] || ["", ""];
		onChange(
			updateMonsterModifierEntry(draft, field, index, [
				current[0],
				event.target.value,
			]),
		);
	};

	return (
		<div className="MonsterFieldEditModal__modifier_sections">
			{MODIFIER_SECTIONS.map((section) => {
				const entries = getMonsterModifierEntries(draft, section.field);
				return (
					<section
						key={section.field}
						className="MonsterFieldEditModal__modifier_section"
					>
						<div className="MonsterFieldEditModal__compact_header">
							<strong>{lang.t(section.label)}</strong>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="plus"
								onClick={() =>
									onChange(addMonsterModifierEntry(draft, section.field))
								}
							>
								{lang.t(section.addLabel)}
							</Button>
						</div>
						{entries.length > 0 ? (
							<div className="MonsterFieldEditModal__modifier_rows">
								{entries.map(([key, value], index) => (
									<div
										key={`${section.field}-${index}`}
										className="MonsterFieldEditModal__modifier_row"
									>
									<ModifierKeyInput
										value={key}
										placeholder={section.field === "save" ? "dex" : "perception"}
										onCommit={(nextKey) =>
											onChange(
												updateMonsterModifierEntry(draft, section.field, index, [
													nextKey,
													value,
												]),
											)
										}
									/>
										<TextInput
											value={String(value)}
											aria-label={lang.t("Modifier")}
											placeholder="+0"
										onChange={(event) =>
											updateEntryValue(section.field, index, event)
										}
										/>
										<Button
											variant="ghost"
											size={Button.SIZES.SMALL}
											icon="trash"
											title={lang.t("Remove entry")}
											aria-label={lang.t("Remove entry")}
											onClick={() =>
												onChange(
													removeMonsterModifierEntry(
														draft,
														section.field,
														index,
													),
												)
											}
										/>
									</div>
								))}
							</div>
						) : (
							<span className="MonsterFieldEditModal__empty">
								{lang.t("No entries.")}
							</span>
						)}
					</section>
				);
			})}
		</div>
	);
}
