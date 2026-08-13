import type { ReactNode } from "react";

interface AiResponsePreviewResourceHeaderProps {
	actions: ReactNode;
	label: ReactNode;
	state: ReactNode;
}

export default function AiResponsePreviewResourceHeader({
	actions,
	label,
	state,
}: AiResponsePreviewResourceHeaderProps) {
	return (
		<div className="AiAssistant__preview_resource_header">
			<span>{label}</span>
			<div className="AiAssistant__preview_resource_actions">
				<span>{state}</span>
				{actions}
			</div>
		</div>
	);
}
