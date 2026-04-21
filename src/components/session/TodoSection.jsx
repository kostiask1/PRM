export default function TodoSection({ title, children, action }) {
	return (
		<section className="TodoSection">
			<div className="TodoSection__header">
				<h3>{title}</h3>
				{action}
			</div>
			{children && <div className="TodoSection__body">{children}</div>}
		</section>
	);
}
