import { useEffect, useMemo, useState } from "react";
import Icon from "./common/Icon";
import "../assets/components/ImageTargetSettings.css";
import classNames from "../utils/classNames";
import { lang } from "../services/localization";

const SUB_LABELS = {
	npc: "NPC",
	players: "Players",
};

function normalizePath(path) {
	return String(path || "")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/{2,}/g, "/");
}

export default function ImageTargetSettings({
	title = "Category",
	categories = [],
	sources = [],
	sourceTitle = "Source",
	value,
	onChange,
	loadSubcategories,
	createSubcategory,
}) {
	const [nestedSubs, setNestedSubs] = useState([]);
	const [isLoadingSubs, setIsLoadingSubs] = useState(false);
	const [isCreatingSub, setIsCreatingSub] = useState(false);
	const [newSubName, setNewSubName] = useState("");
	const [isCreatingSubPending, setIsCreatingSubPending] = useState(false);

	const activeCategory = categories.find((cat) => cat.id === value.category);
	const staticSubs = activeCategory?.subs || [];
	const currentSub = normalizePath(value.subcategory);
	const atRoot = currentSub === "";
	const pathParts = useMemo(
		() => currentSub.split("/").filter(Boolean),
		[currentSub],
	);

	const setPatch = (patch) => onChange?.({ ...value, ...patch });

	useEffect(() => {
		let cancelled = false;

		if (!loadSubcategories || !value?.category) {
			setNestedSubs([]);
			return;
		}

		const run = async () => {
			setIsLoadingSubs(true);
			try {
				const items = await loadSubcategories({
					source: value.source,
					category: value.category,
					subcategory: currentSub,
				});
				if (cancelled) return;
				setNestedSubs(Array.isArray(items) ? items : []);
			} catch {
				if (!cancelled) setNestedSubs([]);
			} finally {
				if (!cancelled) setIsLoadingSubs(false);
			}
		};

		run();
		return () => {
			cancelled = true;
		};
	}, [loadSubcategories, value.source, value.category, currentSub]);

	const subButtons = atRoot && staticSubs.length > 0 ? staticSubs : nestedSubs;

	const handleSelectCategory = (cat) => {
		setPatch({
			category: cat.id,
			subcategory: "",
		});
	};

	const handleEnterSubfolder = (segment) => {
		const next = normalizePath(
			currentSub ? `${currentSub}/${segment}` : segment,
		);
		setPatch({ subcategory: next });
	};

	const handleNavigateToPart = (index) => {
		if (index < 0) {
			setPatch({ subcategory: "" });
			return;
		}
		const next = pathParts.slice(0, index + 1).join("/");
		setPatch({ subcategory: normalizePath(next) });
	};

	const handleBack = () => {
		if (!pathParts.length) return;
		setPatch({ subcategory: pathParts.slice(0, -1).join("/") });
	};

	const handleCreateSub = async () => {
		const cleanName = String(newSubName || "").trim();
		if (!cleanName || !createSubcategory || isCreatingSubPending) return;
		const fullPath = normalizePath(
			currentSub ? `${currentSub}/${cleanName}` : cleanName,
		);
		setIsCreatingSubPending(true);
		try {
			await createSubcategory({
				source: value.source,
				category: value.category,
				subcategory: currentSub,
				name: cleanName,
				fullPath,
			});
			setPatch({ subcategory: fullPath });
			setNewSubName("");
			setIsCreatingSub(false);
		} catch (err) {
			console.error("Failed to create subcategory", err);
		} finally {
			setIsCreatingSubPending(false);
		}
	};

	return (
		<div className="ImageTargetSettings">
			{sources.length > 0 && (
				<div className="ImageTargetSettings__categories">
					<label>{lang.t(sourceTitle)}:</label>
					<div className="ImageTargetSettings__grid">
						{sources.map((source) => (
							<button
								key={source.id}
								type="button"
								className={classNames("ImageTargetSettings__categoryBtn", {
									"is-active": value.source === source.id,
								})}
								onClick={() => setPatch({ source: source.id, subcategory: "" })}
							>
								<Icon name={source.icon || "database"} size={18} />
								{source.label}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="ImageTargetSettings__categories">
				<label>{lang.t(title)}:</label>
				<div className="ImageTargetSettings__grid">
					{categories.map((cat) => (
						<button
							key={cat.id}
							type="button"
							className={classNames("ImageTargetSettings__categoryBtn", {
								"is-active": value.category === cat.id,
							})}
							onClick={() => handleSelectCategory(cat)}
						>
							<Icon name={cat.icon} size={18} />
							{lang.t(cat.label)}
						</button>
					))}
				</div>
			</div>

			<div className="ImageTargetSettings__subcategories">
				<label>{lang.t("Subcategory")}:</label>

				<div className="ImageTargetSettings__pathBar">
					<button
						type="button"
						className={classNames("ImageTargetSettings__pathBtn", {
							"is-active": atRoot,
						})}
						onClick={() => handleNavigateToPart(-1)}
					>
						<Icon name="home" size={14} />
					</button>
					{pathParts.map((part, index) => (
						<button
							key={`${part}-${index}`}
							type="button"
							className={classNames("ImageTargetSettings__pathBtn", {
								"is-active": index === pathParts.length - 1,
							})}
							onClick={() => handleNavigateToPart(index)}
						>
							{lang.t(SUB_LABELS[part] || part)}
						</button>
					))}
					{typeof createSubcategory === "function" && (
						<div className="ImageTargetSettings__newSub">
							{isCreatingSub ? (
								<>
									<input
										autoFocus
										value={newSubName}
										onChange={(e) => setNewSubName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleCreateSub();
											if (e.key === "Escape") {
												setIsCreatingSub(false);
												setNewSubName("");
											}
										}}
										placeholder={lang.t("Folder name...")}
									/>
									<button
										type="button"
										className="ImageTargetSettings__newSubBtn"
										onClick={handleCreateSub}
										disabled={isCreatingSubPending}
									>
										<Icon name="check" size={14} />
									</button>
									<button
										type="button"
										className="ImageTargetSettings__newSubBtn"
										onClick={() => {
											setIsCreatingSub(false);
											setNewSubName("");
										}}
										disabled={isCreatingSubPending}
									>
										<Icon name="x" size={14} />
									</button>
								</>
							) : (
								<button
									type="button"
									className="ImageTargetSettings__newSubBtn"
									onClick={() => setIsCreatingSub(true)}
									title={lang.t("Create subfolder")}
								>
									<Icon name="plus" size={14} />
								</button>
							)}
						</div>
					)}
				</div>

				<div className="ImageTargetSettings__tabs">
					<div className="ImageTargetSettings__tabsHeader">
						<div className="ImageTargetSettings__tabsTitle">
							{lang.t("Subfolders")}
						</div>
						<button
							type="button"
							className="ImageTargetSettings__tabBtn ImageTargetSettings__tabBtn--back"
							onClick={handleBack}
							disabled={atRoot}
						>
							{lang.t("Back")}
						</button>
					</div>
					<div className="ImageTargetSettings__tabsList">
						{subButtons.map((sub) => (
							<button
								key={sub}
								type="button"
								className="ImageTargetSettings__tabBtn"
								onClick={() => handleEnterSubfolder(sub)}
							>
								{lang.t(SUB_LABELS[sub] || sub)}
							</button>
						))}
						{!isLoadingSubs && subButtons.length === 0 && (
							<span className="ImageTargetSettings__emptySubs">
								{lang.t("No subfolders")}
							</span>
						)}
						{isLoadingSubs && (
							<span className="ImageTargetSettings__emptySubs">
								{lang.t("Loading...")}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
