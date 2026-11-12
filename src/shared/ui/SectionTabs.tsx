import { type KeyboardEvent } from "react";
import { useRevealSelectedTab } from "./useRevealSelectedTab.ts";
import "../../assets/components/SectionTabs.css";

export interface SectionTab<Id extends string> {
	id: Id;
	label: string;
	count?: number;
}
export interface SectionTabsProps<Id extends string> {
	idPrefix: string;
	label: string;
	items: readonly SectionTab<Id>[];
	value: Id;
	onChange: (id: Id) => void;
}

export default function SectionTabs<Id extends string>({ idPrefix, label, items, value, onChange }: SectionTabsProps<Id>) {
	const tabsRef = useRevealSelectedTab(value);
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!items.length) return;
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
		<div ref={tabsRef} className="SectionTabs" role="tablist" aria-label={label}>
			{items.map((item) => (
				<button key={item.id} type="button" role="tab" id={`${idPrefix}-tab-${item.id}`} aria-controls={`${idPrefix}-panel-${item.id}`}
					aria-selected={value === item.id} tabIndex={value === item.id ? 0 : -1}
					className="SectionTabs__tab" onClick={() => onChange(item.id)} onKeyDown={onKeyDown}>
					{item.label}{item.count !== undefined && <span> · {item.count}</span>}
				</button>
			))}
		</div>
	);
}
