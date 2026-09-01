import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

export interface AiAttachmentAlert {
	title: string;
	message: string;
}

export interface AiAttachmentAlertRuntime {
	showAlert(alert: AiAttachmentAlert): void;
}

export interface AiAttachmentAlertRuntimeProviderProps {
	runtime: AiAttachmentAlertRuntime;
	children?: ReactNode;
}

const AiAttachmentAlertRuntimeContext =
	createContext<AiAttachmentAlertRuntime | null>(null);

export function AiAttachmentAlertRuntimeProvider({
	runtime,
	children,
}: AiAttachmentAlertRuntimeProviderProps) {
	return (
		<AiAttachmentAlertRuntimeContext.Provider value={runtime}>
			{children}
		</AiAttachmentAlertRuntimeContext.Provider>
	);
}

export function useAiAttachmentAlertRuntime(): AiAttachmentAlertRuntime {
	const runtime = useContext(AiAttachmentAlertRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"AiAttachmentAlertRuntimeProvider is required to render AI attachment controls",
		);
	}
	return runtime;
}
