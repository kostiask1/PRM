import { Panel } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import { useEncounterPageController } from "../model/useEncounterPageController.ts";
import "../../../assets/components/EncounterView.css";
import EncounterPageContent from "./components/EncounterPageContent.tsx";

function EncounterView() {
	const controller = useEncounterPageController();
	if (!controller.renderContext) return <EncounterLoading />;

	return (
		<Panel className="EncounterView">
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
