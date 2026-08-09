// vapidConfigured is computed once at module load from these env vars, so they must be set
// before pushNotify.js is required below.
process.env.VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";

jest.mock("../src/config/prisma", () => ({
  push_subscriptions: {
    findMany: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
}));
jest.mock("../src/config/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));
jest.mock("web-push", () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

// expo-server-sdk is real ESM and pushNotify.js only ever requires it lazily inside a function
// (see the comment there) — this mock stands in for that lazy require. chunkPushNotifications
// and sendPushNotificationsAsync are exposed as module-level jest.fn()s so each test can
// configure them directly, since pushNotify.js caches a single Expo instance internally.
const mockChunk = jest.fn(messages => [messages]);
const mockSendPushNotificationsAsync = jest.fn();
jest.mock("expo-server-sdk", () => ({
  Expo: class MockExpo {
    static isExpoPushToken(token) {
      return typeof token === "string" && token.startsWith("ExponentPushToken");
    }
    chunkPushNotifications(...args) { return mockChunk(...args); }
    sendPushNotificationsAsync(...args) { return mockSendPushNotificationsAsync(...args); }
  },
}));

const prisma = require("../src/config/prisma");
const webpush = require("web-push");
const { sendPushToUsers } = require("../src/utils/pushNotify");

const webSub = (id, endpoint = "https://push.example/ep") => ({
  id, platform: "web", subscription: { endpoint, keys: { p256dh: "a", auth: "b" } },
});
const expoSub = (id, token = "ExponentPushToken[abc]") => ({
  id, platform: "expo", subscription: { token },
});

describe("sendPushToUsers", () => {
  beforeEach(() => jest.clearAllMocks());

  test("no subscriptions found — no-op, nothing sent or deleted", async () => {
    prisma.push_subscriptions.findMany.mockResolvedValue([]);
    await sendPushToUsers([1], { title: "Hi", message: "there" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(prisma.push_subscriptions.deleteMany).not.toHaveBeenCalled();
  });

  test("empty userIds short-circuits before ever querying the database", async () => {
    await sendPushToUsers([], { title: "Hi" });
    expect(prisma.push_subscriptions.findMany).not.toHaveBeenCalled();
  });

  describe("web push", () => {
    test("successful send does not delete the subscription", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([webSub(10)]);
      webpush.sendNotification.mockResolvedValue({});
      await sendPushToUsers([1], { title: "Hi", message: "there" });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
      expect(prisma.push_subscriptions.deleteMany).not.toHaveBeenCalled();
    });

    test("410 Gone deletes the dead subscription", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([webSub(11)]);
      webpush.sendNotification.mockRejectedValue({ statusCode: 410 });
      await sendPushToUsers([1], { title: "Hi" });
      expect(prisma.push_subscriptions.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [11] } } });
    });

    test("404 Not Found also deletes the dead subscription", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([webSub(12)]);
      webpush.sendNotification.mockRejectedValue({ statusCode: 404 });
      await sendPushToUsers([1], { title: "Hi" });
      expect(prisma.push_subscriptions.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [12] } } });
    });

    test("a transient error (e.g. 500) is logged but the subscription is kept", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([webSub(13)]);
      webpush.sendNotification.mockRejectedValue({ statusCode: 500, message: "server error" });
      await sendPushToUsers([1], { title: "Hi" });
      expect(prisma.push_subscriptions.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("expo push", () => {
    test("DeviceNotRegistered deletes the dead subscription", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([expoSub(20)]);
      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: "error", details: { error: "DeviceNotRegistered" } },
      ]);
      await sendPushToUsers([1], { title: "Hi" });
      expect(prisma.push_subscriptions.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [20] } } });
    });

    test("a different error status is not treated as dead", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([expoSub(21)]);
      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: "error", details: { error: "MessageTooBig" } },
      ]);
      await sendPushToUsers([1], { title: "Hi" });
      expect(prisma.push_subscriptions.deleteMany).not.toHaveBeenCalled();
    });

    test("successful receipt does not delete the subscription", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([expoSub(22)]);
      mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok" }]);
      await sendPushToUsers([1], { title: "Hi" });
      expect(prisma.push_subscriptions.deleteMany).not.toHaveBeenCalled();
    });

    test("a malformed token is never sent to Expo at all", async () => {
      prisma.push_subscriptions.findMany.mockResolvedValue([expoSub(23, "not-a-real-token")]);
      await sendPushToUsers([1], { title: "Hi" });
      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });
  });

  test("mixed expo + web subscriptions are both pushed independently", async () => {
    prisma.push_subscriptions.findMany.mockResolvedValue([webSub(30), expoSub(31)]);
    webpush.sendNotification.mockResolvedValue({});
    mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok" }]);
    await sendPushToUsers([1, 2], { title: "Hi" });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  test("a database failure while loading subscriptions is logged, not thrown", async () => {
    prisma.push_subscriptions.findMany.mockRejectedValue(new Error("connection lost"));
    await expect(sendPushToUsers([1], { title: "Hi" })).resolves.toBeUndefined();
  });
});
