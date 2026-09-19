import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FEATURES, publicFeatureCatalog } from "./feature-readiness.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("feature-catalog copies stay in sync", () => {
  it("backend and frontend JSON files are identical", () => {
    const backend = readFileSync(join(here, "feature-catalog.json"), "utf8");
    const frontend = readFileSync(join(here, "../../../frontend/src/lib/feature-catalog.json"), "utf8");
    assert.equal(backend, frontend);
  });

  it("runtime catalog matches the JSON file", () => {
    const raw = JSON.parse(readFileSync(join(here, "feature-catalog.json"), "utf8")) as typeof FEATURES;
    assert.deepEqual(FEATURES, raw);
    assert.equal(publicFeatureCatalog().length, Object.keys(raw).length);
  });
});
