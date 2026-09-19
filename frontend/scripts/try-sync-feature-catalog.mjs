/**
 * Copy repo-root feature-catalog.json into this package when the full
 * monorepo is present (local / CI). Isolated Railway builds (root =
 * frontend/) skip this and use the committed copy.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRootCatalog = join(pkgRoot, "..", "feature-catalog.json");
const dest = join(pkgRoot, "src", "lib", "feature-catalog.json");

if (!existsSync(repoRootCatalog)) {
  process.exit(0);
}

copyFileSync(repoRootCatalog, dest);
