import assert from "node:assert/strict";

import { ADMIN_EMAIL, isAdminEmail } from "./admin";

assert.equal(ADMIN_EMAIL, null);
assert.equal(isAdminEmail("admin@example.com"), false);
assert.equal(isAdminEmail("admin@example.com", null), false);
assert.equal(isAdminEmail("admin@example.com", "admin@example.com"), true);
assert.equal(isAdminEmail("not-admin@example.com", "admin@example.com"), false);
assert.equal(isAdminEmail("  Admin@Example.com  ", "admin@example.com"), true);
