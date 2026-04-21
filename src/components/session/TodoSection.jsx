import Button from "../Button";

export default function TodoSection({
	title,
	children,
	action,
	collapsed = false,
	onToggle,
}) {
	const isCollapsible = typeof onToggle === "function";

	return (
		<section className="TodoSection">
			<div
				className={`TodoSection__header ${isCollapsible ? "is-collapsible" : ""}`}
				onClick={() => {
					if (isCollapsible) onToggle();
				}}>
				<div className="TodoSection__titleGroup">
					{isCollapsible && (
						<Button
							variant="ghost"
							size="small"
							icon="chevron"
							className={`TodoSection__toggle ${collapsed ? "is-rotated" : ""}`}
							onClick={(event) => {
								event.stopPropagation();
								onToggle();
							}}
						/>
					)}
					<h3>{title}</h3>
				</div>
				{action}
			</div>
			{!collapsed && children && <div className="TodoSection__body">{children}</div>}
		</section>
	);
}
