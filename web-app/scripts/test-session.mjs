import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import ts from "typescript";

// Compile pure modules without bundling the app or adding a test framework.
mkdirSync(".test-build", { recursive: true });
writeFileSync(".test-build/package.json", '{"type":"commonjs"}');
writeFileSync(".test-build/survey-config.json", readFileSync("lib/survey-config.json"));
for (const name of ["study", "session", "local-workspace", "library"]) {
  const compiled = ts.transpileModule(readFileSync(`lib/${name}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  writeFileSync(`.test-build/${name}.js`, compiled.outputText);
}
const result = spawnSync(process.execPath, ["--test", "tests/session.test.cjs", "tests/local-workspace.test.cjs", "tests/library.test.cjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
