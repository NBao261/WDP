import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import ExpoConstants, { ExecutionEnvironment } from "expo-constants";
import { useAuthStore } from "../src/store/useAuthStore";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";

const isExpoGo =
  ExpoConstants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.warn("expo-notifications not available", e);
  }
}

// Only import push notifications hook if not in Expo Go
const usePushNotificationsHook = !isExpoGo
  ? require("../src/hooks/usePushNotifications").usePushNotifications
  : () => ({ expoPushToken: "", notification: undefined });

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize push notifications (handles registration, token update, and listeners)
  usePushNotificationsHook();

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inDriverGroup = segments[0] === "(driver)";
    const inStaffGroup = segments[0] === "(staff)";

    if (isAuthenticated && inAuthGroup) {
      if (
        user?.role === "staff" ||
        user?.role === "manager" ||
        user?.role === "admin"
      ) {
        router.replace("/(staff)/scan-plate");
      } else {
        router.replace("/(driver)/home");
      }
    } else if (!isAuthenticated && (inDriverGroup || inStaffGroup)) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, segments, fontsLoaded, user, router]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen
          name="index"
          options={{ title: "Smart Parking", headerShown: false }}
        />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(driver)" options={{ headerShown: false }} />
        <Stack.Screen name="(staff)" options={{ headerShown: false }} />
        <Stack.Screen name="facility/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="facility/[id]/book"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="feedback/index"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="feedback/create"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="profile/change-password"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="profile/my-vehicles"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="profile/add-vehicle"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="profile/edit-vehicle"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="navigation/[facilityId]"
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />
      </Stack>
    </>
  );
}
