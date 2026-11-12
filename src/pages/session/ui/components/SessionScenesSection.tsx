import type { ReactNode } from "react";
import "../../../../assets/components/SessionScenesSection.css";
import type { SessionScene } from "../../../../entities/session/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Button, DraggableList } from "../../../../shared/ui/index.js";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";

interface SessionScenesSectionProps {
 scenes: SessionScene[];
 onAddScene: () => void;
 onReorder: (scenes: SessionScene[]) => void;
 onOpenScene: (scene: SessionScene) => void;
 selectedScene: SessionScene | undefined;
 renderScene: (scene: SessionScene) => ReactNode;
 reference?: ReactNode;
}

export default function SessionScenesSection({ scenes, selectedScene, onAddScene, onReorder, onOpenScene, renderScene, reference }: SessionScenesSectionProps) {
 return (
  <div className="SessionWorkspace" data-history-focus-id={makeHistoryTargetId("session", "scenes")}>
   <aside className="SessionWorkspace__outline" aria-label={lang.t("Scenes")}>
    <header><h3>{lang.t("Session plan")}</h3><Button className="SessionWorkspace__compactAdd" variant="ghost" size="sm" icon="plus" aria-label={lang.t("Add scene")} title={lang.t("Add scene")} onClick={onAddScene} /></header>
    <DraggableList items={scenes} onReorder={onReorder} keyExtractor={(scene) => scene.id} keyboardReorder getKeyboardReorderLabel={(_scene, index) => lang.t("Reorder scene {number} (arrow keys)", { number: index + 1 })} renderItem={(scene, _dragging, index) => (
     <button className="SessionWorkspace__scene" type="button" aria-pressed={selectedScene?.id === scene.id} onClick={() => onOpenScene(scene)}>
      <span className="WorkspaceEyebrow">{lang.t("Scene {number}", { number: String(index + 1).padStart(2, "0") })}</span>
      <strong>{String(scene.name || scene.title || scene.texts?.summary || lang.t("Untitled")).split("\n")[0]}</strong>
      <small>{lang.t(scene.encounterId !== null && scene.encounterId !== undefined ? "Combat encounter" : "Preparation")}</small>
     </button>
    )} />
    <Button className="SessionWorkspace__createButton" variant="ghost" icon="plus" onClick={onAddScene}>{lang.t("Add scene")}</Button>
   </aside>
   <div className="SessionWorkspace__editor">
    {selectedScene ? renderScene(selectedScene) : <div className="SessionWorkspace__empty"><h3>{lang.t("Your next adventure starts here")}</h3><Button variant="primary" icon="plus" onClick={onAddScene}>{lang.t("Add scene")}</Button></div>}
   </div>
   <aside className="SessionWorkspace__reference">{reference}</aside>
  </div>
 );
}
