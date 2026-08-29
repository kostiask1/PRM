import type { MouseEvent } from "react";
import {
	Button,
	CollapseToggleButton,
	Icon,
} from "../../../../shared/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";

export interface SceneCardHeaderProps {
	number: number;
	collapsed: boolean;
	onToggle: () => void;
	onOpenEncounter: (event: MouseEvent<HTMLButtonElement>) => void;
	onRemove: () => void;
	hasEncounter: boolean;
	encounterName: string;
}

export default function SceneCardHeader({
	number,
	collapsed,
	onToggle,
	onOpenEncounter,
	onRemove,
	hasEncounter,
	encounterName,
}: SceneCardHeaderProps) {
	return (
		<div className="SessionSceneCard__header">
			<div className="SessionSceneCard__titleGroup" onClick={onToggle}>
				<CollapseToggleButton
					size={Button.SIZES.SMALL}
					collapsed={collapsed}
					onClick={onToggle}
				/>
				<div className="SessionSceneCard__title">
					{lang.t("Scene {number}", { number })}
				</div>
			</div>
			<div className="SessionSceneCard__headerActions">
				<Button
					variant={hasEncounter ? "primary" : "ghost"}
					onClick={(event) => {
						event.stopPropagation();
						onOpenEncounter(event);
					}}
					title={encounterName}
				>
					<Icon name="swords" size={18} className="SessionSceneCard__encounterIcon" />
					<span className="SessionSceneCard__encounterName">
						{renderMentionText(encounterName)}
					</span>
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
