import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Annotator } from "./Annotator";
import type { Annotation } from "./models";

window.addEventListener("DOMContentLoaded", () => {
	const container = document.getElementById("root");
	if (container === null) {
		alert("Failed to initialize application");
		return;
	}

	const root = createRoot(container);
	root.render(<App />);
});

function App() {
	const [annotations, setAnnotations] = useState<Annotation[]>(() => [
		{ start: 3, end: 13, value: "Name" },
		{ start: 2, end: 14, value: "React Component" },
		{ start: 15, end: 20, value: "Library" },
	]);

	return (
		<div
			css={{
				position: "fixed",
				inset: "0",
				padding: "32px",
			}}
		>
			<Annotator
				annotations={annotations}
				onDeleteAnnotation={(annotation) => {
					setAnnotations((annotations) =>
						annotations.filter((a) => a !== annotation),
					);
				}}
				onSaveAnnotation={(annotation) => {
					setAnnotations((annotations) => [...annotations, annotation]);
				}}
			>
				{text}
			</Annotator>
		</div>
	);
}

const text = `
# <Annotation> React Component

- Select text to create an annotation.
- You can create a new annotation overlapping with existing one.
- Click on an annotation to edit it.
	- If there are overlapped annotations, UI asks you which one to edit.
`.trim();
