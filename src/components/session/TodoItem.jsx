import Checkbox from "../Checkbox";
import "../../assets/components/TodoItem.css";
import classNames from "../../utils/classNames";

export default function TodoItem({ title, note, checked, onChange, children }) {
	return (
		<div className={classNames("TodoItem", { "TodoItem--done": checked })}>
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
