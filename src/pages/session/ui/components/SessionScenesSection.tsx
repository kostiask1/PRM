import { useRef, type ReactNode } from "react";
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
 const editorRef = useRef<HTMLDivElement>(null);
 return (
  <div className="SessionWorkspace" data-history-focus-id={makeHistoryTargetId("session", "scenes")}>
   <aside className="SessionWorkspace__outline" aria-label={lang.t("Scenes")}>
    <header><h3>{lang.t("Session plan")}</h3><Button className="SessionWorkspace__compactAdd" variant="ghost" size="sm" icon="plus" aria-label={lang.t("Add scene")} title={lang.t("Add scene")} onClick={onAddScene} /></header>
    <DraggableList items={scenes} onReorder={onReorder} keyExtractor={(scene) => scene.id} keyboardReorder getKeyboardReorderLabel={(_scene, index) => lang.t("Reorder scene {number} (arrow keys)", { number: index + 1 })} renderItem={(scene, _dragging, index) => (
     <button className="SessionWorkspace__scene" type="button" aria-pressed={selectedScene?.id === scene.id} onClick={() => { onOpenScene(scene); editorRef.current?.querySelectorAll<HTMLElement>(":scope > [data-scene-index]")[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>
      <span className="WorkspaceEyebrow">{lang.t("Scene {number}", { number: String(index + 1).padStart(2, "0") })}</span>
      <strong>{String(scene.name || scene.title || scene.texts?.summary || lang.t("Untitled")).split("\n")[0]}</strong>
      <small>{lang.t(scene.encounterId !== null && scene.encounterId !== undefined ? "Combat encounter" : "Preparation")}</small>
     </button>
    )} />
    <Button className="SessionWorkspace__createButton" variant="ghost" icon="plus" onClick={onAddScene}>{lang.t("Add scene")}</Button>
   </aside>
   <div>
    <div ref={editorRef} className="SessionWorkspace__editor SessionWorkspace__editor_stream" onScroll={(event) => {
     const container = event.currentTarget;
     const top = container.getBoundingClientRect().top;
     const cards = Array.from(container.querySelectorAll<HTMLElement>(":scope > [data-scene-index]"));
     const active = cards.reduce<HTMLElement | null>((current, card) => card.getBoundingClientRect().top <= top + 24 ? card : current, cards[0] || null);
     const index = Number(active?.dataset.sceneIndex);
     if (active && scenes[index] && scenes[index].id !== selectedScene?.id) onOpenScene(scenes[index]);
    }}>
     {selectedScene ? scenes.map((scene, index) => <div key={String(scene.id)} data-scene-index={index}>{renderScene(scene)}</div>) : <div className="SessionWorkspace__empty"><h3>{lang.t("Your next adventure starts here")}</h3><Button variant="primary" icon="plus" onClick={onAddScene}>{lang.t("Add scene")}</Button></div>}
    </div>
   </div>
   <aside className="SessionWorkspace__reference">{reference}</aside>
  </div>
 );
}
