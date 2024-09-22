import {
	type ButtonHTMLAttributes,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import type { Annotation, Segment, SegmentGroup, Span } from "./models";
import {
	AnnotatorContextProvider,
	useAnnotatorContext,
} from "./useAnnotatorContext";
import {
	TextSelectionContextProvider,
	useSetNodeSpan,
} from "./useGetSelectionSpan";

const ZWSP = (
	<span
		css={{
			userSelect: "none",
			pointerEvents: "none",
		}}
	>
		{"\u200b"}
	</span>
);

function Annotator() {
	const { segments, resetState, requestNewAnnotation } = useAnnotatorContext();

	useEffect(() => {
		const handleMouseDown = () => {
			resetState();
		};

		document.addEventListener("mousedown", handleMouseDown);
		return () => {
			document.removeEventListener("mousedown", handleMouseDown);
		};
	}, [resetState]);

	return (
		<pre
			css={{
				"--color-group-background-highlighted": "#f0f0f0",
				"--color-group-background-selected": "#e0e0e0",
				"--color-span-background-highlighted": "#c7d2fa",
				"--color-span-background-selected": "#a6b5ff",
				fontFamily: "unset",
				whiteSpace: "pre-wrap",
				lineHeight: 2.5,
			}}
			onMouseUp={requestNewAnnotation}
		>
			{segments.map((segment) => (
				<SegmentView key={segment.segmentId} segment={segment} />
			))}
		</pre>
	);
}

function AnnotatorWithContext({
	annotations,
	children = "",
	onDeleteAnnotation,
	onSaveAnnotation,
}: {
	annotations: Annotation[];
	children?: string;
	onDeleteAnnotation: (span: Annotation) => void;
	onSaveAnnotation: (span: Annotation) => void;
}) {
	return (
		<TextSelectionContextProvider>
			<AnnotatorContextProvider
				annotations={annotations}
				text={children}
				onDeleteAnnotation={onDeleteAnnotation}
				onSaveAnnotation={onSaveAnnotation}
			>
				<Annotator />
			</AnnotatorContextProvider>
		</TextSelectionContextProvider>
	);
}

function SegmentView({ segment }: { segment: Segment }) {
	if (segment.group === null) {
		return <NormalTextSegment segment={segment} />;
	}

	return <AnnotatedSegment segment={segment} group={segment.group} />;
}

function NormalTextSegment({ segment }: { segment: Segment }) {
	const setNodeSpan = useSetNodeSpan();

	return (
		<span ref={(element) => setNodeSpan(element, segment)}>{segment.text}</span>
	);
}

function AnnotatedSegment({
	segment,
	group,
}: { segment: Segment; group: SegmentGroup }) {
	const { state, selectGroup, highlightGroup } = useAnnotatorContext();
	const setNodeSpan = useSetNodeSpan();
	const endWithNewLine = segment.text.endsWith("\n");
	const isGroupHighlighted = state.highlightedGroupId === group.groupId;
	const isGroupSelected = state.selectedGroupId === group.groupId;
	const isSpanHighlighted =
		state.highlightedAnnotation !== null &&
		segment.spans.includes(state.highlightedAnnotation);
	const isAnnotationSelected =
		state.selectedAnnotation !== null &&
		segment.spans.includes(state.selectedAnnotation);
	const isNewAnnotationSpan =
		state.newAnnotation !== null && segment.spans.includes(state.newAnnotation);
	const numAnnotations =
		group.annotations.length -
		(state.newAnnotation !== null && segment.spans.includes(state.newAnnotation)
			? 1
			: 0);

	return (
		<>
			<div
				ref={(element) => setNodeSpan(element, segment)}
				css={{
					position: "relative",
					display: "inline-block",
					textDecoration: "underline 2px solid",

					...(isGroupHighlighted && {
						background: "var(--color-group-background-highlighted)",
					}),
					...(isGroupSelected && {
						background: "var(--color-group-background-selected)",
					}),
					...(isSpanHighlighted && {
						background: "var(--color-span-background-highlighted)",
					}),
					...(isAnnotationSelected && {
						background: "var(--color-span-background-selected)",
					}),
					...(isNewAnnotationSpan && {
						background: "var(--color-span-background-selected)",
					}),

					...(numAnnotations > 1 &&
						group.end === segment.end && {
							"&::after": {
								content: `"${numAnnotations} annotations"`,
								position: "absolute",
								top: "calc(100% - 1em + 4px)",
								right: 0,
								lineHeight: 1,
								fontSize: "0.75em",
								fontFamily: "monospace",
								whiteSpace: "nowrap",
							},
						}),
				}}
				onMouseEnter={() => {
					highlightGroup(group.groupId);
				}}
				onMouseLeave={() => {
					highlightGroup(null);
				}}
				onMouseDown={(ev) => {
					ev.stopPropagation();
				}}
				onClick={() => {
					selectGroup(group.groupId);
				}}
			>
				{segment.text.replace(/\n$/g, "")}
				{state.mode === "newAnnotation" &&
				isNewAnnotationSpan &&
				state.newAnnotation?.end === segment.end ? (
					<CreateAnnotationPopup span={state.newAnnotation} />
				) : state.mode === "annotationSelected" &&
					isAnnotationSelected &&
					state.selectedAnnotation?.end === segment.end ? (
					<AnnotationPopup annotation={state.selectedAnnotation} />
				) : state.mode === "groupSelected" &&
					isGroupSelected &&
					group.end === segment.end ? (
					<SelectAnnotationPopup annotations={group.annotations} />
				) : null}
			</div>
			{endWithNewLine && [ZWSP, "\n"]}
		</>
	);
}

function CreateAnnotationPopup({ span }: { span: Span }) {
	const { saveAnnotation } = useAnnotatorContext();
	const [value, setValue] = useState("");

	return (
		<Popup onClose={() => {}} title="Create Annotation">
			<div
				css={{
					position: "relative",
					display: "flex",
					flexDirection: "row",
					alignItems: "stretch",
					gap: "16px",
				}}
			>
				<input
					type="text"
					placeholder="value"
					value={value}
					onChange={(ev) => setValue(ev.target.value)}
				/>
				<Button
					onClick={() => saveAnnotation({ value, ...span })}
					variant="primary"
				>
					Save
				</Button>
			</div>
		</Popup>
	);
}

function AnnotationPopup({ annotation }: { annotation: Annotation }) {
	const { deleteAnnotation } = useAnnotatorContext();

	return (
		<Popup onClose={() => {}} title="Annotation">
			<Button
				onClick={() => deleteAnnotation(annotation)}
				variant="destructive"
			>
				Remove
			</Button>
		</Popup>
	);
}

function SelectAnnotationPopup({ annotations }: { annotations: Annotation[] }) {
	const { highlightAnnotation, selectAnnotation } = useAnnotatorContext();

	return (
		<Popup onClose={() => {}} title="Select Annotation">
			{annotations.length} annotations found
			<table
				css={{
					marginTop: "16px",
					width: "100%",
					borderCollapse: "collapse",
					tr: {
						border: "1px solid black",

						"&:is(tbody tr)": {
							cursor: "pointer",
							"&:hover": {
								backgroundColor: "lightgray",
							},
						},
					},
					"th, td": {
						padding: "8px",
					},
				}}
			>
				<thead>
					<tr>
						<th>Span</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					{annotations.map((annotation, index) => (
						<tr
							key={`${annotation.start}-${annotation.end}-${index}`}
							onMouseEnter={() => highlightAnnotation(annotation)}
							onMouseLeave={() => highlightAnnotation(null)}
							onClick={() => selectAnnotation(annotation)}
						>
							<td>
								{annotation.start}..{annotation.end}
							</td>
							<td>{annotation.value}</td>
						</tr>
					))}
				</tbody>
			</table>
		</Popup>
	);
}

function Button(
	props: ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: "normal" | "primary" | "destructive";
	},
) {
	const { variant = "normal", ...others } = props;
	return (
		<button
			{...others}
			css={{
				border: "none",
				padding: "8px 16px",
				minHeight: "36px",
				display: "inline-flex",
				flexDirection: "row",
				alignItems: "center",
				gap: "8px",
				borderRadius: "4px",
				cursor: "pointer",
				fontSize: "1em",
				fontFamily: "inherit",

				...(variant === "primary" && {
					backgroundColor: "#2225bd",
					color: "#fff",
				}),
				...(variant === "destructive" && {
					backgroundColor: "#9f0000",
					color: "#fff",
				}),
			}}
		/>
	);
}

function Popup({
	children,
	onClose,
	title,
}: { children?: ReactNode; onClose: () => void; title?: string }) {
	useEffect(() => {
		document.addEventListener("mousedown", onClose);
		return () => {
			document.removeEventListener("mousedown", onClose);
		};
	}, [onClose]);

	return (
		<div
			css={{
				minWidth: "320px",
				position: "absolute",
				top: "100%",
				left: "16px",
				backgroundColor: "white",
				boxShadow: "0 0 5px rgba(0, 0, 0, 0.5)",
				zIndex: 1,
				lineHeight: 1.2,
				borderRadius: "4px",
				color: "#000",
			}}
			onClick={(ev) => {
				ev.stopPropagation();
			}}
			onMouseDown={(ev) => {
				ev.stopPropagation();
			}}
		>
			<h3
				css={{
					margin: 0,
					lineHeight: 1,
					whiteSpace: "nowrap",
					padding: "16px 16px",
					borderBottom: "1px solid #f0f0f0",
				}}
			>
				{title}
			</h3>
			<div
				css={{
					padding: "16px 16px",
				}}
			>
				{children}
			</div>
		</div>
	);
}

export { AnnotatorWithContext as Annotator };
