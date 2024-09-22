export function iterateMatches(
	matcher: RegExp,
	text: string,
): IterableIterator<RegExpExecArray> {
	return {
		[Symbol.iterator]() {
			return this;
		},
		next() {
			const result = matcher.exec(text);
			if (result) {
				return { done: false, value: result };
			}

			return { done: true, value: undefined };
		},
	};
}
