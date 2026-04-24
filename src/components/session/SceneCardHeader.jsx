import Button from "../form/Button";
import CollapseToggleButton from "../common/CollapseToggleButton";
import Icon from "../common/Icon";
import { lang } from "../../services/localization";

export default function SceneCardHeader({
	number,
	collapsed,
	onToggle,
	onOpenEncounter,
	onRemove,
	hasEncounter,
	encounterName,
}) {
	return (
		<div className="SceneCard__header">
			<div className="SceneCard__titleGroup" onClick={onToggle}>
				<CollapseToggleButton
					size={Button.SIZES.SMALL}
					collapsed={collapsed}
					onClick={onToggle}
				/>
				<div className="SceneCard__title">
					{lang.t("Scene {number}", { number })}
				</div>
			</div>
			<div className="SceneCard__headerActions">
				<Button
					variant={hasEncounter ? "primary" : "ghost"}
					onClick={(event) => {
						event.stopPropagation();
						onOpenEncounter(event);
					}}
					title={encounterName}
				>
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
