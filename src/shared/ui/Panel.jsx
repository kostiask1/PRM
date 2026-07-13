import "../../assets/components/Panel.css";
import { classNames } from "../lib/index.js";

export default function Panel({ children, className = "" }) {
	return (
		<section className={classNames("Panel", className)}>{children}</section>
	);
}
