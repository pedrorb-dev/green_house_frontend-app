import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";

import { AppColors } from "@/constants/theme";

const TAB_ICONS = {
  index: { active: "home", inactive: "home-outline" },
  controls: { active: "options", inactive: "options-outline" },
  settings: { active: "settings", inactive: "settings-outline" },
} as const;

function tabBarIcon(route: keyof typeof TAB_ICONS) {
  return ({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: ColorValue;
    size: number;
  }) => {
    const icon = TAB_ICONS[route];
    const iconColor =
      typeof color === "number"
        ? `#${color.toString(16).padStart(6, "0")}`
        : (color ?? undefined);
    return (
      <Ionicons
        name={focused ? icon.active : icon.inactive}
        size={size}
        color={iconColor}
      />
    );
  };
}

export default function TabsLayout() {
  const colors = AppColors;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundElement,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: tabBarIcon("index") }}
      />
      <Tabs.Screen
        name="controls"
        options={{ title: "Controls", tabBarIcon: tabBarIcon("controls") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: tabBarIcon("settings") }}
      />
    </Tabs>
  );
}
