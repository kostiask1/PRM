import {
	EditableField,
	type EditableFieldProps,
} from "../../../../features/editor/ui/index.js";
import "../../../../assets/components/SceneCardFields.css";
import { lang } from "../../../../shared/lib/index.js";

export interface SceneCardFieldDefinition {
	key: string;
	title: string;
	type: NonNullable<EditableFieldProps["type"]>;
	placeholder: string;
}

export interface SceneCardFieldsProps {
	fields: readonly SceneCardFieldDefinition[];
	scene: { texts?: Record<string, unknown> };
	enableHistory?: boolean;
	onUpdateField: (field: string, value: string) => void;
}

export default function SceneCardFields({
	fields,
	scene,
	enableHistory = true,
	onUpdateField,
}: SceneCardFieldsProps) {
	return (
		<div className="SessionSceneCard__grid">
			{fields.map((field) => (
				<div key={field.key} className="SceneCardFields__item">
					<div className="SceneCardFields__title">{lang.t(field.title)}</div>
					<EditableField
						data-history-field={field.key}
						type={field.type}
						value={String(scene.texts?.[field.key] || "")}
						enableHistory={enableHistory}
						onChange={(event) => onUpdateField(field.key, event.target.value)}
						placeholder={lang.t(field.placeholder)}
					/>
				</div>
			))}
		</div>
	);
}
