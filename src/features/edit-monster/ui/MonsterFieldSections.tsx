import type { ReactNode } from "react";

interface MonsterFieldSectionsProps {
	actionSections: ReactNode;
	abilityFields: ReactNode;
	defenseFields: ReactNode;
	descriptionFields: ReactNode;
	exactDataSection: ReactNode;
	loreField: ReactNode;
	metaFields: ReactNode;
	modifierFields: ReactNode;
	nameField: ReactNode;
	referenceFields: ReactNode;
	sourceField: ReactNode;
	spellcastingSections: ReactNode;
	statFields: ReactNode;
}

export default function MonsterFieldSections({
	actionSections,
	abilityFields,
	defenseFields,
	descriptionFields,
	exactDataSection,
	loreField,
	metaFields,
	modifierFields,
	nameField,
	referenceFields,
	sourceField,
	spellcastingSections,
	statFields,
}: MonsterFieldSectionsProps) {
	return (
		<div className="MonsterFieldEditModal__stat_block">
			<div className="MonsterFieldEditModal__stat_header">
				<div className="MonsterFieldEditModal__identity">
					<div className="MonsterFieldEditModal__name_row">{nameField}</div>
					<div className="MonsterFieldEditModal__meta_fields">{metaFields}</div>
					<div className="MonsterFieldEditModal__source_field">{sourceField}</div>
				</div>
				<div className="MonsterFieldEditModal__stats_wrap">
					<div className="MonsterFieldEditModal__primary_stats">
						{statFields}
					</div>
					<div className="MonsterFieldEditModal__properties">
						{modifierFields}
						<div className="MonsterFieldEditModal__defense_fields">
							{defenseFields}
						</div>
						<div className="MonsterFieldEditModal__description_fields">
							{descriptionFields}
						</div>
						<div className="MonsterFieldEditModal__lore_field">
							{loreField}
						</div>
						{referenceFields}
					</div>
				</div>
				<div className="MonsterFieldEditModal__abilities">{abilityFields}</div>
			</div>
			<div className="MonsterFieldEditModal__actions">
				{spellcastingSections}
				{actionSections}
			</div>
			{exactDataSection}
		</div>
	);
}
