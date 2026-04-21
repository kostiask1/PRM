import Button from "../Button";
import Icon from "../Icon";

export default function SceneCardHeader({
	number,
	collapsed,
	onToggle,
	onOpenNpcCreate,
	onOpenEncounter,
	onRemove,
	hasEncounter,
	encounterName,
}) {
	return (
		<div className="SceneCard__header">
			<div className="SceneCard__titleGroup" onClick={onToggle}>
				<div className="SceneCard__toggle">
					<Icon name="chevron" className={collapsed ? "Icon--rotated" : ""} />
				</div>
				<div className="SceneCard__title">{`Scene ${number}`}</div>
			</div>
			<div className="SceneCard__headerActions">
				<Button
					variant="ghost"
					onClick={onOpenNpcCreate}
					icon="plus"
					strokeWidth={2.5}>
					NPC
				</Button>
				<Button
					variant={hasEncounter ? "primary" : "ghost"}
					onClick={(event) => {
						event.stopPropagation();
						onOpenEncounter();
					}}
					title={encounterName}>
					<Icon name="swords" size={18} className="SceneCard__encounter-icon" />
					<span className="SceneCard__encounter-name">{encounterName}</span>
				</Button>
				<Button
					variant="danger"
					icon="x"
					iconSize={16}
					onClick={(event) => {
						event.stopPropagation();
						onRemove();
					}}
				/>
			</div>
		</div>
	);
}
