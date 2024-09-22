import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useState,
} from "react";
import type { Span } from "./models";

interface Context {
	spanByNode: WeakMap<Node, Span>;
}

const context = createContext<Context>(null as never);

export function TextSelectionContextProvider({
	children,
}: { children?: ReactNode }) {
	const [state] = useState(() => ({
		spanByNode: new WeakMap<Node, Span>(),
	}));

	return <context.Provider value={state}>{children}</context.Provider>;
}

export function useGetSelectionSpan() {
	const { spanByNode } = useContext(context);

	const resolveOffset = useCallback(
		(node: Node | null, offsetInNode: number): number | null => {
			let _node = node;
			while (_node !== null) {
				const nodeSpan = spanByNode.get(_node as HTMLElement);
				if (nodeSpan !== undefined) {
					return nodeSpan.start + offsetInNode;
				}
				_node = _node.parentNode;
			}
			return null;
		},
		[spanByNode],
	);

	return useCallback(() => {
		const selection = window.getSelection();
		if (selection === null || selection.isCollapsed) {
			return null;
		}

		const anchorOffset = resolveOffset(
			selection.anchorNode,
			selection.anchorOffset,
		);
		const focusOffset = resolveOffset(
			selection.focusNode,
			selection.focusOffset,
		);
		if (anchorOffset === null || focusOffset === null) {
			return null;
		}

		const start = Math.min(anchorOffset, focusOffset);
		const end = Math.max(anchorOffset, focusOffset);
		return { start, end };
	}, [resolveOffset]);
}

export function useSetNodeSpan() {
	const { spanByNode } = useContext(context);

	return useCallback(
		(node: Node | null, span: Span) => {
			if (node === null) return;
			spanByNode.set(node, span);
		},
		[spanByNode],
	);
}
