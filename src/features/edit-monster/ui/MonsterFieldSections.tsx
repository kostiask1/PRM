import type { ReactNode } from "react";

interface MonsterFieldSectionsProps {
	actionSections: ReactNode;
	abilityFields: ReactNode;
	basicFields: ReactNode;
	textFields: ReactNode;
}

export default function MonsterFieldSections({
	actionSections,
	abilityFields,
	basicFields,
	textFields,
}: MonsterFieldSectionsProps) {
	return (
		<>
			<div className="MonsterFieldEditModal__fields">{basicFields}</div>
			<div className="MonsterFieldEditModal__fields MonsterFieldEditModal__abilities">
				{abilityFields}
			</div>
			<div className="MonsterFieldEditModal__text_fields">{textFields}</div>
			<div className="MonsterFieldEditModal__actions">{actionSections}</div>
		</>
	);
}
