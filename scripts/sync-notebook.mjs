import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notebookPath = path.join(root, "notebooks/say-mine_colab.ipynb");
export const sourceLines = text => text.match(/[^\n]*\n|[^\n]+$/g) || [];

export function syncCore(notebook) {
  const core = readFileSync(path.join(root, "web-app/backend/core.py"), "utf8");
  const knowledge = readFileSync(path.join(root, "web-app/backend/knowledge.md"), "utf8");
  const promptStart = core.indexOf("LEVEL_RULES =");
  const chainStart = core.indexOf("def generation_mode(");
  if (promptStart < 0 || chainStart < promptStart) throw new Error("Core section boundaries changed");
  const sources = {
    schemas: core.slice(0, promptStart),
    prompt: core.slice(promptStart, chainStart),
    chain: core.slice(chainStart) + '\nchain = create_chain(knowledge)\ncontext = prepare_context(my_input, knowledge)\nprint("선택한 표현 수준:", context["selected_level"])\nprint("적용할 표현 규칙:", context["level_rule"])\nprint("사용자 JSON:", context["learner_json"])\n',
    knowledge: `import tempfile\nfrom pathlib import Path\n\nREFERENCE_TEXT = ${JSON.stringify(knowledge)}\nwith tempfile.TemporaryDirectory() as directory:\n    reference_file = Path(directory) / "reference.txt"\n    reference_file.write_text(REFERENCE_TEXT, encoding="utf-8")\n    knowledge = load_knowledge(reference_file)\n`,
  };
  let changed = false;
  for (const [id, text] of Object.entries(sources)) {
    const cell = notebook.cells.find(cell => cell.id === id);
    if (!cell) throw new Error(`Missing cell: ${id}`);
    if (cell.source.join("") !== text) { cell.source = sourceLines(text); changed = true; }
  }
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const original = readFileSync(notebookPath, "utf8");
  const notebook = JSON.parse(original);
  const changed = syncCore(notebook);
  if (process.argv.includes("--check")) {
    console.log(changed ? "Notebook core differs from web core." : "Notebook and web core match.");
    process.exit(changed ? 1 : 0);
  }
  if (changed) {
    for (const cell of notebook.cells.filter(cell => cell.cell_type === "code")) { cell.outputs = []; cell.execution_count = null; }
    const updated = JSON.stringify(notebook, null, 1) + "\n";
    console.log(`*** Begin Patch\n*** Update File: ${notebookPath}\n@@\n${original.trimEnd().split("\n").map(line => "-" + line).join("\n")}\n${updated.trimEnd().split("\n").map(line => "+" + line).join("\n")}\n*** End Patch`);
  }
}
