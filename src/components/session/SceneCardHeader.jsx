import Button from "../Button";
import CollapseToggleButton from "../CollapseToggleButton";
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
				<CollapseToggleButton
					size="sm"
					collapsed={collapsed}
					onClick={onToggle}
				/>
				<div className="SceneCard__title">{`Сцена ${number}`}</div>
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
