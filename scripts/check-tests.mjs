import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const testDir = fileURLToPath(new URL("../test/", import.meta.url));

let files;
try {
  files = readdirSync(testDir).filter((name) => name.endsWith(".test.js"));
} catch {
  console.error(`check-tests: cannot read ${testDir}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`check-tests: no *.test.js files found in ${testDir}`);
  process.exit(1);
}
