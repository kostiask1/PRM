import "../../assets/components/Panel.css";
import classNames from "../../utils/classNames";

export default function Panel({ children, className = "" }) {
	return (
		<section className={classNames("Panel", className)}>{children}</section>
	);
}
