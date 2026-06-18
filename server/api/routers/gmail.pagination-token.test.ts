import assert from "node:assert/strict";

Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? "test" });
process.env.DATABASE_URL ||=
  "postgres://postgres:postgres@localhost:5432/postgres";
process.env.CORSAIR_KEK ||= "test-kek";
process.env.BETTER_AUTH_SECRET ||= "test-better-auth-secret";
process.env.BETTER_AUTH_URL ||= "https://slotnest.test";
process.env.RAZORPAY_KEY_ID ||= "test-razorpay-key-id";
process.env.RAZORPAY_KEY_SECRET ||= "test-razorpay-key-secret";
process.env.RAZORPAY_PRO_PLAN_ID ||= "test-razorpay-pro-plan-id";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.RESEND_API_KEY ||= "test-resend-api-key";
process.env.EMAIL_FROM ||= "SlotNest <noreply@slotnest.test>";
process.env.APP_URL ||= "https://slotnest.test";

async function main() {
  const {
    decodeInboxCachePageToken,
    encodeInboxCachePageToken,
    shouldUseCachedInboxPage,
  } = await import("@/server/api/routers/gmail");

  const livePageToken = "CAoQAA";

  assert.equal(decodeInboxCachePageToken(undefined), null);
  assert.equal(decodeInboxCachePageToken(livePageToken), null);

  assert.equal(encodeInboxCachePageToken(0), "cache:0");
  assert.equal(encodeInboxCachePageToken(25), "cache:25");
  assert.equal(decodeInboxCachePageToken("cache:25"), 25);

  assert.equal(
    shouldUseCachedInboxPage({
      cachedMessageCount: 25,
      pageToken: undefined,
    }),
    true,
  );

  assert.equal(
    shouldUseCachedInboxPage({
      cachedMessageCount: 25,
      pageToken: "cache:25",
    }),
    true,
  );

  assert.equal(
    shouldUseCachedInboxPage({
      cachedMessageCount: 25,
      pageToken: livePageToken,
    }),
    false,
  );

  assert.equal(
    shouldUseCachedInboxPage({
      cachedMessageCount: 0,
      pageToken: livePageToken,
    }),
    false,
  );
}

main().catch((error) => {
  throw error;
});
