import "../../assets/components/Panel.css";
import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../lib/index.js";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
	children?: ReactNode;
	className?: string;
}

export default function Panel({ children, className = "", ...props }: PanelProps) {
	return (
		<section {...props} className={classNames("Panel", className)}>{children}</section>
	);
}
