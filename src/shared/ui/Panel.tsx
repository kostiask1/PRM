import "../../assets/components/Panel.css";
import type { ReactNode } from "react";
import { classNames } from "../lib/index.js";

export interface PanelProps {
	children?: ReactNode;
	className?: string;
}

export default function Panel({ children, className = "" }: PanelProps) {
	return (
		<section className={classNames("Panel", className)}>{children}</section>
	);
}
