import {
	useEffect,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";

export function useMobileSidebar(
	pathname: string,
): [boolean, Dispatch<SetStateAction<boolean>>] {
	const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

	useEffect(() => {
		setMobileSidebarOpen(false);
	}, [pathname]);

	useEffect(() => {
		document.body.classList.toggle(
			"is-mobile-sidebar-open",
			isMobileSidebarOpen,
		);

		return () => {
			document.body.classList.remove("is-mobile-sidebar-open");
		};
	}, [isMobileSidebarOpen]);

	useEffect(() => {
		if (!isMobileSidebarOpen) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setMobileSidebarOpen(false);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isMobileSidebarOpen]);

	return [isMobileSidebarOpen, setMobileSidebarOpen];
}
