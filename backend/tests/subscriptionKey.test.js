const { subscriptionKey } = require("../src/controllers/pushController");

describe("subscriptionKey (push subscription dedup key)", () => {
  test("expo platform keys on the token", () => {
    expect(subscriptionKey("expo", { token: "ExponentPushToken[abc]" })).toBe("ExponentPushToken[abc]");
  });

  test("web platform keys on the endpoint, not the token field", () => {
    const subscription = { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } };
    expect(subscriptionKey("web", subscription)).toBe("https://fcm.googleapis.com/x");
  });

  test("expo platform ignores an endpoint field if present", () => {
    expect(subscriptionKey("expo", { token: "t", endpoint: "should-be-ignored" })).toBe("t");
  });

  test("missing token on expo platform returns undefined", () => {
    expect(subscriptionKey("expo", {})).toBeUndefined();
  });

  test("missing endpoint on web platform returns undefined", () => {
    expect(subscriptionKey("web", {})).toBeUndefined();
  });

  test("null/undefined subscription returns undefined rather than throwing", () => {
    expect(subscriptionKey("expo", null)).toBeUndefined();
    expect(subscriptionKey("web", undefined)).toBeUndefined();
  });
});
