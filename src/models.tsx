export interface Span {
	start: number;
	end: number;
}

export interface Annotation extends Span {
	value: string;
}

/**
 * A segment is a piece of text. While overlapped ranges
 * are grouped into a single SegmentGroup, they are rendered
 * as collections of non-overlapped Segments.
 *
 * For example, ranges [0, 5) and [3, 8) are grouped into
 * a single SegmentGroup [0, 8) and rendered as 3 Segments:
 * [0, 3), [3, 5), and [5, 8).
 */
export interface Segment extends Span {
	segmentId: number;
	group: SegmentGroup | null;
	text: string;
	spans: Span[];
}

/**
 * A group of overlapped ranges
 */
export interface SegmentGroup extends Span {
	groupId: number;
	annotations: Annotation[];
}
