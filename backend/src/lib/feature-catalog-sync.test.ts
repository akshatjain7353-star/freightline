import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FEATURES, publicFeatureCatalog } from "./feature-readiness.js";

const here = dirname(fileURLToPath(import.meta.url));
const backendCopy = join(here, "feature-catalog.json");
const frontendCopy = join(here, "../../../frontend/src/lib/feature-catalog.json");
const repoRoot = join(here, "../../../feature-catalog.json");

describe("feature-catalog copies stay in sync", () => {
  it("backend and frontend JSON files are identical", () => {
    assert.equal(readFileSync(backendCopy, "utf8"), readFileSync(frontendCopy, "utf8"));
  });

  it("package copies match the repo-root source of truth when it is present", () => {
    assert.equal(existsSync(repoRoot), true, "expected feature-catalog.json at the repo root");
    const root = readFileSync(repoRoot, "utf8");
    assert.equal(readFileSync(backendCopy, "utf8"), root);
    assert.equal(readFileSync(frontendCopy, "utf8"), root);
  });

  it("runtime catalog matches the JSON file", () => {
    const raw = JSON.parse(readFileSync(backendCopy, "utf8")) as typeof FEATURES;
    assert.deepEqual(FEATURES, raw);
    assert.equal(publicFeatureCatalog().length, Object.keys(raw).length);
  });
});
