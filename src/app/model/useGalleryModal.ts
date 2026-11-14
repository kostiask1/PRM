import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

export function useGalleryModal() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const [isOpen, setOpen] = useState(false);
	useEffect(() => {
		if (pathname !== "/gallery") return;
		setOpen(true);
		navigate("/", { replace: true });
	}, [pathname, navigate]);
	return { isOpen, setOpen };
}
