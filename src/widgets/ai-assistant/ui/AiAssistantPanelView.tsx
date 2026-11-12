import type { ComponentProps } from "react";
import {
	AiApiKeyPanel,
	AiAssistantShell,
	AiAssistantToolbar,
	AiContextSettingsModal,
	AiHistoryResponseDialog,
	AiResponseHistory,
} from "../../../features/ai/ui/index.js";
import { AiAssistantPromptComposer } from "./aiAssistantUiComposition.ts";
import { Icon } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";

export interface AiAssistantPanelViewProps {
	shell: Omit<ComponentProps<typeof AiAssistantShell>, "children">;
	workspace: { scope: string; target: string; path: string; result: string; context: string };
	toolbar: ComponentProps<typeof AiAssistantToolbar>;
	apiKey: ComponentProps<typeof AiApiKeyPanel> | null;
	contextModal: ComponentProps<typeof AiContextSettingsModal>;
	historyDialog: ComponentProps<typeof AiHistoryResponseDialog>;
	promptComposer: ComponentProps<typeof AiAssistantPromptComposer>;
	error: string;
	history: ComponentProps<typeof AiResponseHistory>;
}

export default function AiAssistantPanelView({
	shell,
	workspace,
	toolbar,
	apiKey,
	contextModal,
	historyDialog,
	promptComposer,
	error,
	history,
}: AiAssistantPanelViewProps) {
	return (
		<AiAssistantShell {...shell}>
			<div className="AiAssistantPanel__workspace">
				<Icon name="wand" size={20} />
				<div className="AiAssistantPanel__workspace_identity">
					<span className="AiAssistantPanel__workspace_label">{lang.t("Current workspace")} · {workspace.scope}</span>
					<strong>{workspace.target}</strong>
					{workspace.path && <span>{workspace.path}</span>}
				</div>
				<div className="AiAssistantPanel__workspace_summary">
					<span>{workspace.result}</span>
					{workspace.context && <span>{workspace.context}</span>}
				</div>
			</div>
			<AiAssistantToolbar {...toolbar} />
			{apiKey ? <AiApiKeyPanel {...apiKey} /> : null}
			<AiContextSettingsModal {...contextModal} />
			<AiHistoryResponseDialog {...historyDialog} />
			<AiAssistantPromptComposer {...promptComposer} />
			{error ? <div className="AiAssistantPanel__error">{error}</div> : null}
			<AiResponseHistory {...history} />
		</AiAssistantShell>
	);
}
