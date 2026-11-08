import type { ReactNode } from "react";
import "../../../../assets/components/SessionScenesSection.css";
import type { SessionScene } from "../../../../entities/session/index.js";
import { BulkCollapseButton } from "../../../../features/notes/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Button, DraggableList } from "../../../../shared/ui/index.js";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";

interface SessionScenesSectionProps {
 scenes: SessionScene[];
 onBulkCollapse: (collapsed: boolean) => void;
 onAddScene: () => void;
 onReorder: (scenes: SessionScene[]) => void;
 onOpenScene: (scene: SessionScene) => void;
 selectedScene: SessionScene | undefined;
 renderScene: (scene: SessionScene) => ReactNode;
 reference?: ReactNode;
}

export default function SessionScenesSection({ scenes, selectedScene, onBulkCollapse, onAddScene, onReorder, onOpenScene, renderScene, reference }: SessionScenesSectionProps) {
 return (
  <div className="SessionWorkspace" data-history-focus-id={makeHistoryTargetId("session", "scenes")}>
   <aside className="SessionWorkspace__outline" aria-label={lang.t("Scenes")}>
    <header><h3>{lang.t("Scenes")}</h3><Button variant="ghost" size="sm" icon="plus" title={lang.t("Add scene")} onClick={onAddScene} /></header>
    <DraggableList items={scenes} onReorder={onReorder} keyExtractor={(scene) => scene.id} renderItem={(scene, _dragging, index) => (
     <button className="SessionWorkspace__scene" type="button" aria-pressed={selectedScene?.id === scene.id} onClick={() => onOpenScene(scene)}>
      <span className="WorkspaceEyebrow">{lang.t("Scene {number}", { number: String(index + 1).padStart(2, "0") })}</span>
      <strong>{String(scene.name || scene.title || scene.texts?.summary || lang.t("Untitled")).split("\n")[0]}</strong>
      <small>{lang.t(scene.encounterId !== null && scene.encounterId !== undefined ? "Combat encounter" : "Preparation")}</small>
     </button>
    )} />
    <Button variant="ghost" icon="plus" onClick={onAddScene}>{lang.t("Add scene")}</Button>
    <BulkCollapseButton items={scenes} onChange={onBulkCollapse} />
   </aside>
   <div className="SessionWorkspace__editor">
    {selectedScene ? renderScene(selectedScene) : <div className="SessionWorkspace__empty"><h3>{lang.t("Your next adventure starts here")}</h3><Button variant="primary" icon="plus" onClick={onAddScene}>{lang.t("Add scene")}</Button></div>}
   </div>
   <aside className="SessionWorkspace__reference">{reference}</aside>
  </div>
 );
}
