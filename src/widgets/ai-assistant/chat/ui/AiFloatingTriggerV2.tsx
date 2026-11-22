interface AiFloatingTriggerV2Props {
	onClick: () => void;
	isOpen?: boolean;
}

export default function AiFloatingTriggerV2({
	onClick,
	isOpen = false,
}: AiFloatingTriggerV2Props) {
	if (isOpen) return null;

	return (
		<button
			type="button"
			className="AiFloatingTriggerV2"
			onClick={onClick}
			title="Відкрити AI-асистент (Ctrl+J)"
			aria-label="Відкрити AI-асистент"
		>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
				<path d="M12 2.5 14.4 9.6 21.5 12 14.4 14.4 12 21.5 9.6 14.4 2.5 12 9.6 9.6 12 2.5Z" />
			</svg>
		</button>
	);
}
