import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useState,
} from "react";
import { isNotNullish } from "./libs/isNotNullish";
import { iterateMatches } from "./libs/iterateMatches";
import type { Annotation, Segment, SegmentGroup, Span } from "./models";
import { useGetSelectionSpan } from "./useGetSelectionSpan";

interface State {
	mode: "normal" | "groupSelected" | "annotationSelected" | "newAnnotation";
	highlightedAnnotation: Annotation | null;
	selectedAnnotation: Annotation | null;
	highlightedGroupId: number | null;
	selectedGroupId: number | null;
	newAnnotation: {
		start: number;
		end: number;
	} | null;
}

interface Context {
	state: State;
	segments: Segment[];
	groups: SegmentGroup[];
	highlightGroup: (groupId: number | null) => void;
	highlightAnnotation: (annotation: Annotation | null) => void;
	selectGroup: (groupId: number) => void;
	selectAnnotation: (annotation: Annotation) => void;
	deleteAnnotation: (annotation: Annotation) => void;
	saveAnnotation: (annotation: Annotation) => void;
	requestNewAnnotation: () => void;
	resetState: () => void;
}

const context = createContext<Context>(null as never);

export function AnnotatorContextProvider({
	annotations,
	text,
	children,
	onDeleteAnnotation,
	onSaveAnnotation,
}: {
	text: string;
	annotations: Annotation[];
	children?: ReactNode;
	onDeleteAnnotation: (annotation: Annotation) => void;
	onSaveAnnotation: (annotation: Annotation) => void;
}) {
	const [state, setState] = useState<State>({
		mode: "normal",
		highlightedAnnotation: null,
		selectedAnnotation: null,
		highlightedGroupId: null,
		selectedGroupId: null,
		newAnnotation: null,
	});

	const resetState = useCallback(() => {
		setState((state) => ({
			...state,
			mode: "normal",
			selectedAnnotation: null,
			highlightedAnnotation: null,
			selectedGroupId: null,
			highlightedGroupId: null,
			newAnnotation: null,
		}));
	}, []);

	const getSelectionSpan = useGetSelectionSpan();
	const { groups, segments } = splitIntoSegments(
		[...annotations, state.newAnnotation].filter(isNotNullish),
		text,
	);

	const highlightGroup = useCallback((groupId: number | null) => {
		setState((state) => ({ ...state, highlightedGroupId: groupId }));
	}, []);

	const highlightAnnotation = useCallback((annotation: Annotation | null) => {
		setState((state) => ({ ...state, highlightedAnnotation: annotation }));
	}, []);

	const selectGroup = useCallback(
		(groupId: number) => {
			const group = groups.find((group) => group.groupId === groupId);
			setState((state) => {
				if (group === undefined || state.mode !== "normal") {
					return state;
				}

				if (group.annotations.length === 1) {
					return {
						...state,
						mode: "annotationSelected",
						selectedGroupId: groupId,
						highlightedGroupId: groupId,
						selectedAnnotation: group.annotations[0],
						highlightedAnnotation: null,
					};
				}

				return {
					...state,
					mode: "groupSelected",
					selectedGroupId: groupId,
					highlightedGroupId: groupId,
					selectedAnnotation: null,
					highlightedAnnotation: null,
				};
			});
		},
		[groups],
	);

	const selectAnnotation = useCallback((annotation: Annotation) => {
		setState((state) => ({
			...state,
			mode: "annotationSelected",
			selectedAnnotation: annotation,
		}));
	}, []);

	const deleteAnnotation = useCallback(
		(annotation: Annotation) => {
			onDeleteAnnotation(annotation);
			resetState();
		},
		[onDeleteAnnotation, resetState],
	);

	const saveAnnotation = useCallback(
		(annotation: Annotation) => {
			onSaveAnnotation(annotation);
			resetState();
		},
		[onSaveAnnotation, resetState],
	);

	const requestNewAnnotation = useCallback(() => {
		const span = getSelectionSpan();
		if (span === null) return;

		document.getSelection()?.removeAllRanges();

		setState((state) => ({
			...state,
			mode: "newAnnotation",
			selectedAnnotation: null,
			selectedGroupId: null,
			newAnnotation: span,
		}));
	}, [getSelectionSpan]);

	return (
		<context.Provider
			value={{
				state,
				segments,
				groups,
				highlightGroup,
				highlightAnnotation,
				selectGroup,
				selectAnnotation,
				deleteAnnotation,
				saveAnnotation,
				requestNewAnnotation,
				resetState,
			}}
		>
			{children}
		</context.Provider>
	);
}

export function useAnnotatorContext() {
	return useContext(context);
}

function splitIntoSegments(
	spans: Span[],
	text: string,
): {
	groups: SegmentGroup[];
	segments: Segment[];
} {
	const splitPointMap = new Map<
		number,
		{
			startSpans: Span[];
			endSpans: Span[];
			newline: boolean;
		}
	>();
	function getOrCreateSplitPoint(index: number) {
		let entry = splitPointMap.get(index);
		if (!entry) {
			entry = { startSpans: [], endSpans: [], newline: false };
			splitPointMap.set(index, entry);
		}
		return entry;
	}

	getOrCreateSplitPoint(0);
	getOrCreateSplitPoint(text.length);

	for (const span of spans) {
		if (span.end - span.start > 20) {
			// Add extra split points for long spans.
			for (let i = span.start + 1; i < span.end; i++) {
				getOrCreateSplitPoint(i);
			}
		}
		getOrCreateSplitPoint(span.start).startSpans.push(span);
		getOrCreateSplitPoint(span.end).endSpans.push(span);
	}

	// Chunk with annotations are rendered as inline-block. If chunk contains '\n',
	// rendering results in multiple lines. To avoid this, we split the chunk at '\n'.
	for (const match of iterateMatches(/(\n)/g, text)) {
		getOrCreateSplitPoint(match.index + 1).newline = true;
	}

	const splitPoints = Array.from(splitPointMap.entries()).sort(
		([pos1], [pos2]) => pos1 - pos2,
	);

	let activeGroup: SegmentGroup | null = null;
	const activeSpans = new Set<Span>();

	const segments: Segment[] = [];
	const groups: SegmentGroup[] = [];
	for (const [position, entry] of splitPoints) {
		for (const span of entry.endSpans) {
			activeSpans.delete(span);

			if (activeGroup !== null) {
				activeGroup.end = position;
				if (activeSpans.size === 0) {
					activeGroup = null;
				}
			}
		}

		for (const span of entry.startSpans) {
			if (activeGroup === null) {
				activeGroup = {
					groupId: groups.length,
					annotations: [],
					start: position,
					end: position,
				};
				groups.push(activeGroup);
			}
			activeGroup.annotations.push(span as Annotation);
			activeSpans.add(span);
		}

		if (segments.length > 0) {
			const lastSegment = segments[segments.length - 1];
			lastSegment.end = position;
			lastSegment.text = text.slice(lastSegment.start, lastSegment.end);
		}

		segments.push({
			segmentId: segments.length,
			group: activeGroup,
			start: position,
			spans: Array.from(activeSpans),

			// Dummy value. updated later.
			text: text.slice(position, text.length),
			end: text.length,
		});
	}

	return { segments, groups };
}
