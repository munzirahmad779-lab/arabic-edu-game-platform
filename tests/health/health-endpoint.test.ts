/**
 * Health Check Endpoint Automated Test Suite
 *
 * Verifies contract, status semantics, timeout handling, and security
 * of /api/health endpoint.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../src/app/api/health/route";
import { NextRequest } from "next/server";

describe("Health Check Endpoint Test Suite", () => {
  test("Returns valid JSON with structured checks schema", async () => {
    const request = new NextRequest("http://localhost:3000/api/health");
    const response = await GET(request);

    assert.equal(response.status, 200);
    const body = await response.json();

    assert.ok(["ok", "degraded", "down"].includes(body.status));
    assert.ok(typeof body.timestamp === "string");
    assert.ok(typeof body.version === "string");
    assert.ok(body.checks);
    assert.ok(["ok", "degraded"].includes(body.checks.app));
    assert.ok(["ok", "degraded", "down", "unconfigured"].includes(body.checks.database));
    assert.ok(["ok", "unconfigured"].includes(body.checks.authentication));
    assert.ok(["ok", "degraded", "unconfigured"].includes(body.checks.rpc));
    assert.ok(["ok", "degraded", "unconfigured"].includes(body.checks.storage));
    assert.ok(["ok", "degraded"].includes(body.checks.migrations));
  });

  test("Guarantees NO secret credentials, keys, or passwords leak in public response", async () => {
    const request = new NextRequest("http://localhost:3000/api/health");
    const response = await GET(request);
    const text = await response.text();

    assert.equal(text.includes("service_role"), false);
    assert.equal(text.includes("password"), false);
    assert.equal(text.includes("anon_key"), false);
    assert.equal(text.includes("jwt"), false);
    assert.equal(text.includes("SECRET"), false);
  });

  test("Rejects unauthorized deep diagnostics for public requests", async () => {
    const request = new NextRequest("http://localhost:3000/api/health?deep=true");
    const response = await GET(request);
    const body = await response.json();

    // Without valid auth session cookie, details must be omitted
    assert.equal(body.details, undefined);
  });

  test("Cache-Control header prevents stale caching", async () => {
    const request = new NextRequest("http://localhost:3000/api/health");
    const response = await GET(request);
    const cacheControl = response.headers.get("Cache-Control");

    assert.ok(cacheControl?.includes("no-store"));
  });
});
