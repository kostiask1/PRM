import "../../assets/components/ListCard.css";
import type {
	HTMLAttributes,
	MouseEvent,
	ReactNode,
} from "react";
import { classNames } from "../lib/index.js";
import { getListCardClickPlan } from "./listCardModel.ts";

export interface ListCardProps
	extends Omit<
		HTMLAttributes<HTMLElement>,
		"children" | "className" | "onClick"
	> {
	children?: ReactNode;
	actions?: ReactNode;
	active?: boolean;
	onClick?: () => void;
	href?: string;
	className?: string;
}

function ListCardActions({ actions }: { actions?: ReactNode }) {
	if (!actions) return null;
	return <div className="ListCard__actions">{actions}</div>;
}

export default function ListCard({
	children, // Main card content (title, meta)
	actions, // Right-side actions (status badge, buttons)
	active = false,
	onClick,
	href,
	className = "",
	...dragProps // Drag-and-drop props (draggable, onDragStart, etc.)
}: ListCardProps) {
	const combinedClassName = classNames("ListCard", className, {
		ListCard__active: active,
	});

	const handleClick = (
		event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
	) => {
		const plan = getListCardClickPlan(href, Boolean(onClick), event);
		if (plan.preventDefault) event.preventDefault();
		if (plan.invokeOnClick) onClick?.();
	};

	const mainContent = href ? (
		<a className="ListCard__main" onClick={handleClick} href={href}>
			{children}
		</a>
	) : (
		<button className="ListCard__main" onClick={handleClick}>
			{children}
		</button>
	);

	return (
		<article className={combinedClassName} {...dragProps}>
			{mainContent}
			<ListCardActions actions={actions} />
		</article>
	);
}
