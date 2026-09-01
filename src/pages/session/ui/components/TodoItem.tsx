import type { ReactNode } from "react";
import { Checkbox } from "../../../../shared/ui/index.js";
import "../../../../assets/components/TodoItem.css";
import { classNames } from "../../../../shared/lib/index.js";

export interface TodoItemProps {
	title?: ReactNode;
	note?: ReactNode;
	checked: boolean;
	onChange: (checked: boolean) => void;
	children?: ReactNode;
}

export default function TodoItem({
	title,
	note,
	checked,
	onChange,
	children,
}: TodoItemProps) {
	return (
		<div className={classNames("TodoItem", { TodoItem__done: checked })}>
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
