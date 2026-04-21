import Checkbox from "../Checkbox";
import "../../assets/components/TodoItem.css";

export default function TodoItem({ title, note, checked, onChange, children }) {
	return (
		<div className={`TodoItem ${checked ? "TodoItem--done" : ""}`}>
			<Checkbox
				checked={checked}
				onChange={onChange}
				label={
					<div className="TodoItem__content">
						<div className="TodoItem__trigger">
							{title && <div className="TodoItem__title">{title}</div>}
							{note && <div className="TodoItem__note">{note}</div>}
						</div>
						{children}
					</div>
				}
			/>
		</div>
	);
}
