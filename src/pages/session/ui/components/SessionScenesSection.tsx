import type { ReactNode } from "react";
import "../../../../assets/components/SessionScenesSection.css";
import type { SessionScene } from "../../../../entities/session/index.js";
import { BulkCollapseButton } from "../../../../features/notes/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Button, DraggableList } from "../../../../shared/ui/index.js";
import TodoSection from "./TodoSection.tsx";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";

interface SessionScenesSectionProps {
	scenes: SessionScene[];
	onBulkCollapse: (collapsed: boolean) => void;
	onAddScene: () => void;
	onReorder: (scenes: SessionScene[]) => void;
	renderScene: (scene: SessionScene) => ReactNode;
}

export default function SessionScenesSection({
	scenes,
	onBulkCollapse,
	onAddScene,
	onReorder,
	renderScene,
}: SessionScenesSectionProps) {
	return (
		<TodoSection
			title={lang.t("Scenes")}
			historyFocusId={makeHistoryTargetId("session", "scenes")}
			action={
				<div className="SessionScenesSection__actions">
					<BulkCollapseButton items={scenes} onChange={onBulkCollapse} />
					<Button
						variant="primary"
						size={Button.SIZES.SMALL}
						onClick={onAddScene}
						icon="plus"
						iconSize={16}
						className="SessionScenesSection__mobileIconOnly"
					>
						{lang.t("Add")}
					</Button>
				</div>
			}
		>
			{scenes.length > 0 && (
				<DraggableList
					items={scenes}
					onReorder={onReorder}
					keyExtractor={(scene) => scene.id}
					renderItem={renderScene}
				/>
			)}
		</TodoSection>
	);
}
