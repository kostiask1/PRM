import type { ReactNode } from "react";
import { Button, CollapseToggleButton } from "../../../../shared/ui/index.js";
import { classNames } from "../../../../shared/lib/index.js";

export interface TodoSectionProps {
	title: ReactNode;
	children?: ReactNode;
	action?: ReactNode;
	collapsed?: boolean;
	onToggle?: () => void;
}

export default function TodoSection({
	title,
	children,
	action,
	collapsed = false,
	onToggle,
}: TodoSectionProps) {
	const isCollapsible = typeof onToggle === "function";

	return (
		<section className="TodoSection">
			<div
				className={classNames("TodoSection__header", {
					is_collapsible: isCollapsible,
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
							onClick={() => onToggle?.()}
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
