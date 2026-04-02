import "./Panel.css";

export default function Panel({ children, className = "" }) {
	return <section className={`Panel ${className}`}>{children}</section>;
}
