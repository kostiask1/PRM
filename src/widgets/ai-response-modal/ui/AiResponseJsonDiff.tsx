import type { AiResponseModalProps } from "../../../features/ai/ui/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";

interface AiResponseJsonDiffProps {
	getDiffResourceState: AiResponseModalProps["getDiffResourceState"];
	resources: AiResponseModalProps["selectedResponseDiffResources"];
}

type AiResponseDiffResource =
	AiResponseModalProps["selectedResponseDiffResources"][number];
type AiResponseDiffLine = AiResponseDiffResource["lines"][number];

function getDiffLineMarker(type: AiResponseDiffLine["type"]): string {
	return type === "added" ? "+" : type === "removed" ? "-" : " ";
}

function AiResponseJsonDiffLine({
	line,
}: {
	line: AiResponseDiffLine;
}) {
	return (
		<div
			className={classNames(
				"AiAssistantPanel__diff_line",
				`is_${line.type}`,
			)}
		>
			<span className="AiAssistantPanel__diff_line_number">
				{line.oldNumber || ""}
			</span>
			<span className="AiAssistantPanel__diff_line_number">
				{line.newNumber || ""}
			</span>
			<span className="AiAssistantPanel__diff_line_marker">
				{getDiffLineMarker(line.type)}
			</span>
			<code>{line.text || " "}</code>
		</div>
	);
}

export default function AiResponseJsonDiff({
	getDiffResourceState,
	resources,
}: AiResponseJsonDiffProps) {
	return resources.map((resource) => (
		<div key={resource.id} className="AiAssistantPanel__diff_file">
			<div className="AiAssistantPanel__diff_file_header">
				<span>{resource.label}</span>
				<span>{getDiffResourceState(resource)}</span>
			</div>
			{resource.fieldSummary.length > 0 && (
				<div className="AiAssistantPanel__diff_field_summary">
					<span>{lang.t("Changed fields")}:</span>
					{resource.fieldSummary.map((field) => (
						<code key={`${resource.id}-${field}`}>{field}</code>
					))}
				</div>
			)}
			<div className="AiAssistantPanel__diff_lines">
				{resource.lines.map((line, index) => (
					<AiResponseJsonDiffLine
						key={`${resource.id}-${index}`}
						line={line}
					/>
				))}
			</div>
		</div>
	));
}
