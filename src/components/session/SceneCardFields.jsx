import EditableField from "../EditableField";

export default function SceneCardFields({ fields, scene, onUpdateField }) {
	return (
		<div className="SceneCard__grid">
			{fields.map((field) => (
				<div key={field.key} className="TodoItem__content">
					<div className="TodoItem__title">{field.title}</div>
					<EditableField
						type={field.type}
						value={scene.texts?.[field.key] || ""}
						onChange={(event) => onUpdateField(field.key, event.target.value)}
						placeholder={field.placeholder}
					/>
				</div>
			))}
		</div>
	);
}
