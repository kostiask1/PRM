export interface PartialArchiveModalProps {
	isBusy?: boolean;
	onCancel: () => void;
	onExport: (sections: string[]) => void | Promise<void>;
	onImport: (file: File, sections: string[]) => void | Promise<void>;
}

export default function PartialArchiveModal(props: PartialArchiveModalProps): import("react").ReactNode;
