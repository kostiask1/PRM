import { EditableField } from "../../../../features/editor/ui/index.js";
import "../../../../assets/components/SceneCardFields.css";
import { lang } from "../../../../shared/lib/index.js";

export default function SceneCardFields({
	fields,
	scene,
	enableHistory = true,
	onUpdateField,
}) {
	return (
		<div className="SceneCard__grid">
			{fields.map((field) => (
				<div key={field.key} className="SceneCardFields__item">
					<div className="SceneCardFields__title">{lang.t(field.title)}</div>
					<EditableField
						type={field.type}
						value={scene.texts?.[field.key] || ""}
						enableHistory={enableHistory}
						onChange={(event) => onUpdateField(field.key, event.target.value)}
						placeholder={lang.t(field.placeholder)}
					/>
				</div>
			))}
		</div>
	);
}
