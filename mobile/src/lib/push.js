import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "./api";

// Foreground behaviour — without this, notifications that arrive while the app is open never
// show a banner/sound (Expo's default is silent-in-foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Registers this device for push and tells the backend about it. Returns the Expo push token
// on success, or throws with a message meant to be shown to the user (not logged and swallowed
// silently — a failed registration means they genuinely won't get pushes, worth surfacing).
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    throw new Error("Push notifications require a physical device (not a simulator/emulator).");
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    throw new Error("Notification permission wasn't granted.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Expo push tokens are minted against an EAS project — this is a hard requirement of Expo's
  // push service itself, not something this app can work around. Without `eas init` having been
  // run for this project (linking it to an Expo account), projectId is undefined and
  // getExpoPushTokenAsync throws.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error(
      "This app isn't linked to an EAS project yet, so Expo can't issue a push token. " +
      "Run `eas init` (needs an Expo account) to fix this."
    );
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  await api.post("/api/push/register", { platform: "expo", subscription: { token } });

  return token;
}

export async function unregisterPushNotifications(token) {
  if (!token) return;
  await api.post("/api/push/unregister", { platform: "expo", subscription: { token } }).catch(() => {});
}
