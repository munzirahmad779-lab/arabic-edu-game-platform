import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSouqFishingEnabled } from "../../bridge/magguru-bridge";

describe("Phase 5 Integration: Feature Flag Safety Suite", () => {
  it("isSouqFishingEnabled() returns false when environment variables are unset", () => {
    const emptyEnv = {};
    const enabled = isSouqFishingEnabled(emptyEnv);
    assert.equal(enabled, false);
  });

  it("isSouqFishingEnabled() returns true when NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE is 'true'", () => {
    const activeEnv = { NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE: "true" };
    assert.equal(isSouqFishingEnabled(activeEnv), true);

    const activeEnv1 = { NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE: "1" };
    assert.equal(isSouqFishingEnabled(activeEnv1), true);

    const activeFallback = { ENABLE_SOUQ_FISHING_MODULE: "true" };
    assert.equal(isSouqFishingEnabled(activeFallback), true);
  });

  it("isSouqFishingEnabled() returns false when environment variable is 'false' or '0'", () => {
    const disabledEnv = { NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE: "false" };
    assert.equal(isSouqFishingEnabled(disabledEnv), false);

    const disabledEnv0 = { NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE: "0" };
    assert.equal(isSouqFishingEnabled(disabledEnv0), false);

    const disabledFallback = { ENABLE_SOUQ_FISHING_MODULE: "false" };
    assert.equal(isSouqFishingEnabled(disabledFallback), false);
  });
});
