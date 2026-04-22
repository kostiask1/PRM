import CollapseToggleButton from "../common/CollapseToggleButton";
import classNames from "../../utils/classNames";
import Button from "../form/Button";

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
				className={classNames("TodoSection__header", {
					"is-collapsible": isCollapsible,
				})}
				onClick={() => {
					if (isCollapsible) onToggle();
				}}
			>
				<div className="TodoSection__titleGroup">
					{isCollapsible && (
						<CollapseToggleButton
							size={Button.SIZES.MEDIUM}
							collapsed={collapsed}
							onClick={() => onToggle()}
						/>
					)}
					<h3>{title}</h3>
				</div>
				{action}
			</div>
			{!collapsed && children && (
				<div className="TodoSection__body">{children}</div>
			)}
		</section>
	);
}
