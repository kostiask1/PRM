import "../../assets/components/ListCard.css";
import classNames from "../../shared/lib/classNames.js";

export default function ListCard({
	children, // Main card content (title, meta)
	actions, // Right-side actions (status badge, buttons)
	active = false,
	onClick,
	href,
	className = "",
	...dragProps // Drag-and-drop props (draggable, onDragStart, etc.)
}) {
	const combinedClassName = classNames("ListCard", className, {
		ListCard__active: active,
	});

	const handleClick = (e) => {
		if (href && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			if (onClick) onClick();
		} else if (!href && onClick) {
			onClick();
		}
	};

	const Component = href ? "a" : "button";

	return (
		<article className={combinedClassName} {...dragProps}>
			<Component className="ListCard__main" onClick={handleClick} href={href}>
				{children}
			</Component>
			{actions && <div className="ListCard__actions">{actions}</div>}
		</article>
	);
}
