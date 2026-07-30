import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { Colors, Typography } from "../../src/constants/theme";
import { useSocketConnection } from "../../src/hooks/useSocket";

function TabIcon({
  name,
  color,
  focused,
}: {
  name: any;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={focused ? Colors.brandLime : color} />
    </View>
  );
}

export default function DriverLayout() {
  // Kết nối socket.io khi driver đăng nhập
  useSocketConnection();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.brandLime,
        tabBarInactiveTintColor: Colors.brandGrayText,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: Typography.fontFamily.semiBold,
          marginTop: 0,
        },
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          paddingTop: 6,
          shadowColor: "#14161C",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 12,
        },
        headerStyle: {
          backgroundColor: Colors.white,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          fontFamily: Typography.fontFamily.bold,
          fontSize: Typography.fontSize.md,
        },
      }}
    >
      {/* ── Driver Tabs ── */}
      <Tabs.Screen
        name="home"
        options={{
          href: "/(driver)/home",
          title: "Trang chủ",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "home" : "home-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="facilities"
        options={{
          href: null,
          title: "Bãi xe",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "map" : "map-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          href: "/(driver)/sessions",
          title: "QR Code",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "qr-code" : "qr-code-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* ── Shared Tabs ── */}
      <Tabs.Screen
        name="account"
        options={{
          title: "Tôi",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "person" : "person-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="reservations" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  iconWrapActive: {
    backgroundColor: Colors.brandDark,
    borderRadius: 14,
  },
});
