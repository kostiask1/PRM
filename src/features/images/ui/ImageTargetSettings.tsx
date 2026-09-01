import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Icon } from "../../../shared/ui/index.js";
import type { IconName } from "../../../shared/ui/index.js";
import "../../../assets/components/ImageTargetSettings.css";
import { classNames } from "../../../shared/lib/index.js";
import { getSourceFullName } from "../../../entities/reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import type { ImageGalleryCategory } from "../model/contracts.ts";
import {
	enterImageTargetSubfolder,
	getImageTargetParentPath,
	getImageTargetPathParts,
	navigateImageTargetPath,
	normalizeImageTargetPath,
	normalizeSubcategoryNames,
	type ImageTargetSourceOption,
	type ImageTargetValue,
} from "../model/imageTargetSettings.ts";

const SUB_LABELS: Readonly<Record<string, string>> = {
	npc: "NPC",
	players: "Players",
};

function getSubLabel(value: string, useSourceName = false): string {
	const label = lang.t(SUB_LABELS[value] || value);
	return useSourceName ? getSourceFullName(label) : label;
}

export interface ImageSubcategoryQuery {
	source: string;
	category: string;
	subcategory: string;
}

export interface ImageSubcategoryCreate extends ImageSubcategoryQuery {
	name: string;
	fullPath: string;
}

export interface ImageTargetSettingsProps {
	title?: string;
	categories?: ImageGalleryCategory[];
	sources?: ImageTargetSourceOption[];
	sourceTitle?: string;
	value: ImageTargetValue;
	onChange?: (value: ImageTargetValue) => void;
	loadSubcategories?: (query: ImageSubcategoryQuery) => Promise<unknown>;
	createSubcategory?: (input: ImageSubcategoryCreate) => Promise<unknown>;
}

function ImageTargetSourceOptions({
	activeSource,
	onSelect,
	sourceTitle,
	sources,
}: {
	activeSource: string;
	onSelect: (source: string) => void;
	sourceTitle: string;
	sources: ImageTargetSourceOption[];
}) {
	if (sources.length === 0) return null;
	return (
		<div className="ImageTargetSettings__categories">
			<label>{lang.t(sourceTitle)}:</label>
			<div className="ImageTargetSettings__grid">
				{sources.map((source) => (
					<button
						key={source.id}
						type="button"
						className={classNames("ImageTargetSettings__categoryBtn", {
							is_active: activeSource === source.id,
						})}
						onClick={() => onSelect(source.id)}
					>
						<Icon name={source.icon || "database"} size={18} />
						{source.label}
					</button>
				))}
			</div>
		</div>
	);
}

function ImageTargetCategoryOptions({
	activeCategory,
	categories,
	onSelect,
	title,
}: {
	activeCategory: string;
	categories: ImageGalleryCategory[];
	onSelect: (category: ImageGalleryCategory) => void;
	title: string;
}) {
	return (
		<div className="ImageTargetSettings__categories">
			<label>{lang.t(title)}:</label>
			<div className="ImageTargetSettings__grid">
				{categories.map((category) => (
					<button
						key={category.id}
						type="button"
						className={classNames("ImageTargetSettings__categoryBtn", {
							is_active: activeCategory === category.id,
						})}
						onClick={() => onSelect(category)}
					>
						<Icon name={category.icon as IconName} size={18} />
						{lang.t(category.label)}
					</button>
				))}
			</div>
		</div>
	);
}

interface ImageTargetPathBarProps {
	atRoot: boolean;
	canCreate: boolean;
	isCreating: boolean;
	isPending: boolean;
	newSubName: string;
	onCancelCreate: () => void;
	onChangeName: (name: string) => void;
	onCreate: () => void;
	onNavigate: (index: number) => void;
	onStartCreate: () => void;
	pathParts: string[];
	useSourceNames: boolean;
}

function ImageTargetPathBar({
	atRoot,
	canCreate,
	isCreating,
	isPending,
	newSubName,
	onCancelCreate,
	onChangeName,
	onCreate,
	onNavigate,
	onStartCreate,
	pathParts,
	useSourceNames,
}: ImageTargetPathBarProps) {
	const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") onCreate();
		if (event.key === "Escape") onCancelCreate();
	};
	return (
		<div className="ImageTargetSettings__pathBar">
			<button
				type="button"
				className={classNames("ImageTargetSettings__pathBtn", {
					is_active: atRoot,
				})}
				onClick={() => onNavigate(-1)}
			>
				<Icon name="home" size={14} />
			</button>
			{pathParts.map((part, index) => (
				<button
					key={`${part}-${index}`}
					type="button"
					className={classNames("ImageTargetSettings__pathBtn", {
						is_active: index === pathParts.length - 1,
					})}
					onClick={() => onNavigate(index)}
				>
					{getSubLabel(part, useSourceNames)}
				</button>
			))}
			{canCreate && (
				<div className="ImageTargetSettings__newSub">
					{isCreating ? (
						<>
							<input
								autoFocus
								value={newSubName}
								onChange={(event: ChangeEvent<HTMLInputElement>) =>
									onChangeName(event.target.value)
								}
								onKeyDown={handleNameKeyDown}
								placeholder={lang.t("Folder name...")}
							/>
							<button
								type="button"
								className="ImageTargetSettings__newSubBtn"
								onClick={onCreate}
								disabled={isPending}
							>
								<Icon name="check" size={14} />
							</button>
							<button
								type="button"
								className="ImageTargetSettings__newSubBtn"
								onClick={onCancelCreate}
								disabled={isPending}
							>
								<Icon name="x" size={14} />
							</button>
						</>
					) : (
						<button
							type="button"
							className="ImageTargetSettings__newSubBtn"
							onClick={onStartCreate}
							title={lang.t("Create subfolder")}
						>
							<Icon name="plus" size={14} />
						</button>
					)}
				</div>
			)}
		</div>
	);
}

function ImageTargetSubfolderTabs({
	atRoot,
	isLoading,
	onBack,
	onEnter,
	subfolders,
	useSourceNames,
}: {
	atRoot: boolean;
	isLoading: boolean;
	onBack: () => void;
	onEnter: (subfolder: string) => void;
	subfolders: string[];
	useSourceNames: boolean;
}) {
	return (
		<div className="ImageTargetSettings__tabs">
			<div className="ImageTargetSettings__tabsHeader">
				<div className="ImageTargetSettings__tabsTitle">
					{lang.t("Subfolders")}
				</div>
				<button
					type="button"
					className="ImageTargetSettings__tabBtn ImageTargetSettings__tabBtn__back"
					onClick={onBack}
					disabled={atRoot}
				>
					{lang.t("Back")}
				</button>
			</div>
			<div className="ImageTargetSettings__tabsList">
				{subfolders.map((subfolder) => (
					<button
						key={subfolder}
						type="button"
						className="ImageTargetSettings__tabBtn"
						onClick={() => onEnter(subfolder)}
					>
						{getSubLabel(subfolder, useSourceNames)}
					</button>
				))}
				{!isLoading && subfolders.length === 0 && (
					<span className="ImageTargetSettings__emptySubs">
						{lang.t("No subfolders")}
					</span>
				)}
				{isLoading && (
					<span className="ImageTargetSettings__emptySubs">
						{lang.t("Loading...")}
					</span>
				)}
			</div>
		</div>
	);
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
}: ImageTargetSettingsProps) {
	const [nestedSubs, setNestedSubs] = useState<string[]>([]);
	const [isLoadingSubs, setIsLoadingSubs] = useState(false);
	const [isCreatingSub, setIsCreatingSub] = useState(false);
	const [newSubName, setNewSubName] = useState("");
	const [isCreatingSubPending, setIsCreatingSubPending] = useState(false);

	const activeCategory = categories.find((cat) => cat.id === value.category);
	const staticSubs = activeCategory?.subs || [];
	const currentSub = normalizeImageTargetPath(value.subcategory);
	const atRoot = currentSub === "";
	const pathParts = useMemo(
		() => getImageTargetPathParts(currentSub),
		[currentSub],
	);

	const setPatch = (patch: Partial<ImageTargetValue>) =>
		onChange?.({ ...value, ...patch });

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
				setNestedSubs(normalizeSubcategoryNames(items));
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
	const useBestiarySourceNames =
		value.source === "general" && value.category === "tokens";

	const handleSelectCategory = (cat: ImageGalleryCategory) => {
		setPatch({
			category: cat.id,
			subcategory: "",
		});
	};

	const handleEnterSubfolder = (segment: string) => {
		const next = enterImageTargetSubfolder(currentSub, segment);
		setPatch({ subcategory: next });
	};

	const handleNavigateToPart = (index: number) => {
		setPatch({ subcategory: navigateImageTargetPath(currentSub, index) });
	};

	const handleBack = () => {
		if (!pathParts.length) return;
		setPatch({ subcategory: getImageTargetParentPath(currentSub) });
	};

	const handleCreateSub = async () => {
		const cleanName = String(newSubName || "").trim();
		if (!cleanName || !createSubcategory || isCreatingSubPending) return;
		const fullPath = enterImageTargetSubfolder(currentSub, cleanName);
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
	const cancelCreateSub = () => {
		setIsCreatingSub(false);
		setNewSubName("");
	};

	return (
		<div className="ImageTargetSettings">
			<ImageTargetSourceOptions
				activeSource={value.source}
				onSelect={(source) => setPatch({ source, subcategory: "" })}
				sourceTitle={sourceTitle}
				sources={sources}
			/>
			<ImageTargetCategoryOptions
				activeCategory={value.category}
				categories={categories}
				onSelect={handleSelectCategory}
				title={title}
			/>
			<div className="ImageTargetSettings__subcategories">
				<label>{lang.t("Subcategory")}:</label>
				<ImageTargetPathBar
					atRoot={atRoot}
					canCreate={typeof createSubcategory === "function"}
					isCreating={isCreatingSub}
					isPending={isCreatingSubPending}
					newSubName={newSubName}
					onCancelCreate={cancelCreateSub}
					onChangeName={setNewSubName}
					onCreate={() => void handleCreateSub()}
					onNavigate={handleNavigateToPart}
					onStartCreate={() => setIsCreatingSub(true)}
					pathParts={pathParts}
					useSourceNames={useBestiarySourceNames}
				/>
				<ImageTargetSubfolderTabs
					atRoot={atRoot}
					isLoading={isLoadingSubs}
					onBack={handleBack}
					onEnter={handleEnterSubfolder}
					subfolders={subButtons}
					useSourceNames={useBestiarySourceNames}
				/>
			</div>
		</div>
	);
}
