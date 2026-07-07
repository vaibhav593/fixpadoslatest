import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, getCachedUser, setCachedUser } from "@/src/api";

/**
 * Worker route-group guard: only sessions with `kyc_status === "approved"`
 * may enter the jobs / earnings / profile tabs. Everyone else is bounced
 * to the appropriate onboarding / pending / rejected page.
 */
export default function WorkerLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const cached = await getCachedUser();
      if (!cached || cached.role !== "worker") {
        router.replace("/role");
        return;
      }
      try {
        const me = await api.me();
        await setCachedUser(me);
        const status = (me as any).kyc_status;
        if (status === "approved") {
          setReady(true);
          return;
        }
        if (status === "submitted") router.replace("/worker-pending");
        else if (status === "rejected") router.replace("/worker-rejected");
        else router.replace("/worker-onboarding");
      } catch {
        router.replace("/role");
      }
    })();
  }, [router]);

  if (!ready) {
    return (
      <View testID="worker-guard-loading" style={styles.wrap}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#10B981",
        tabBarInactiveTintColor: "#94A3B8",
        sceneContainerStyle: { backgroundColor: "#0F172A" },
        tabBarStyle: {
          backgroundColor: "#1E293B",
          borderTopColor: "#334155",
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{ title: "Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: "Earnings", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F172A" },
});
