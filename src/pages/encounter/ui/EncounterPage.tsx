import { Panel } from "../../../shared/ui/index.js";
import { lang, makeDomId } from "../../../shared/lib/index.js";
import { useEncounterPageController } from "../model/useEncounterPageController.ts";
import { makeHistoryTargetId } from "../../../entities/history/index.js";
import "../../../assets/components/EncounterView.css";
import EncounterPageContent from "./components/EncounterPageContent.tsx";

function EncounterView() {
	const controller = useEncounterPageController();
	if (!controller.renderContext) return <EncounterLoading />;

	return (
		<Panel
			id={makeDomId("encounter", "summary", controller.view.encounter?.id)}
			data-history-focus-id={makeHistoryTargetId("encounter", "summary")}
			className="EncounterView"
		>
			<EncounterPageContent controller={controller} />
		</Panel>
	);
}

function EncounterLoading() {
	return (
		<Panel className="EncounterView">
			<div className="Panel__body">{lang.t("Loading...")}</div>
		</Panel>
	);
}

export default EncounterView;
