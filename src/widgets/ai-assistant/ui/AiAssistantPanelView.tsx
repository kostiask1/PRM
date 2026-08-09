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

export interface AiAssistantPanelViewProps {
	shell: Omit<ComponentProps<typeof AiAssistantShell>, "children">;
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
			<AiAssistantToolbar {...toolbar} />
			{apiKey ? <AiApiKeyPanel {...apiKey} /> : null}
			<AiContextSettingsModal {...contextModal} />
			<AiHistoryResponseDialog {...historyDialog} />
			<AiAssistantPromptComposer {...promptComposer} />
			{error ? <div className="AiAssistant__error">{error}</div> : null}
			<AiResponseHistory {...history} />
		</AiAssistantShell>
	);
}
