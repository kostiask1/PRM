import CollapseToggleButton from "../CollapseToggleButton";

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
						<CollapseToggleButton
							size="md"
							collapsed={collapsed}
							onClick={() => onToggle()}
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
