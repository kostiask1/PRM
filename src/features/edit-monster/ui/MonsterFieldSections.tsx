import type { ReactNode } from "react";

interface MonsterFieldSectionsProps {
	actionSections: ReactNode;
	abilityFields: ReactNode;
	defenseFields: ReactNode;
	descriptionFields: ReactNode;
	loreField: ReactNode;
	metaFields: ReactNode;
	nameField: ReactNode;
	sourceField: ReactNode;
	statFields: ReactNode;
}

export default function MonsterFieldSections({
	actionSections,
	abilityFields,
	defenseFields,
	descriptionFields,
	loreField,
	metaFields,
	nameField,
	sourceField,
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
						<div className="MonsterFieldEditModal__defense_fields">
							{defenseFields}
						</div>
						<div className="MonsterFieldEditModal__description_fields">
							{descriptionFields}
						</div>
						<div className="MonsterFieldEditModal__lore_field">
							{loreField}
						</div>
					</div>
				</div>
				<div className="MonsterFieldEditModal__abilities">{abilityFields}</div>
			</div>
			<div className="MonsterFieldEditModal__actions">{actionSections}</div>
		</div>
	);
}
