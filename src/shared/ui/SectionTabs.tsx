import { type KeyboardEvent } from "react";
import "../../assets/components/SectionTabs.css";

export interface SectionTab<Id extends string> {
	id: Id;
	label: string;
	count?: number;
}
export interface SectionTabsProps<Id extends string> {
	label: string;
	items: readonly SectionTab<Id>[];
	value: Id;
	onChange: (id: Id) => void;
}

export default function SectionTabs<Id extends string>({ label, items, value, onChange }: SectionTabsProps<Id>) {
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const index = items.findIndex((item) => item.id === value);
		let next: number;
		if (event.key === "ArrowRight") next = (index + 1) % items.length;
		else if (event.key === "ArrowLeft") next = (index + items.length - 1) % items.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = items.length - 1;
		else return;
		event.preventDefault();
		onChange(items[next].id);
		event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
	};
	return (
		<div className="SectionTabs" role="tablist" aria-label={label}>
			{items.map((item) => (
				<button key={item.id} type="button" role="tab"
					aria-selected={value === item.id} tabIndex={value === item.id ? 0 : -1}
					className="SectionTabs__tab" onClick={() => onChange(item.id)} onKeyDown={onKeyDown}>
					{item.label}{item.count !== undefined && <span> · {item.count}</span>}
				</button>
			))}
		</div>
	);
}
