import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearSession } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

const NAV = [
  { route: "/dashboard", label: "Dashboard", icon: "speedometer" },
  { route: "/workers", label: "Workers (KYC)", icon: "people" },
  { route: "/categories", label: "Categories", icon: "grid" },
  { route: "/banners", label: "Banners", icon: "image" },
  { route: "/bookings", label: "Bookings", icon: "calendar" },
  { route: "/analytics", label: "Analytics", icon: "bar-chart" },
] as const;

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const router = useRouter();
  const segs = useSegments();
  const current = "/" + segs.join("/");
  const isWide = Platform.OS === "web";

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={[styles.row, !isWide && { flexDirection: "column" }]}>
        {/* Sidebar */}
        <View style={[styles.sidebar, !isWide && styles.sidebarMobile]}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}>
              <Ionicons name="shield-checkmark" color="#fff" size={18} />
            </View>
            <Text style={styles.brandTxt}>FixPados Admin</Text>
          </View>
          <ScrollView horizontal={!isWide} showsHorizontalScrollIndicator={false}
            contentContainerStyle={!isWide ? { gap: 8, paddingHorizontal: 8 } : undefined}>
            {NAV.map((n) => {
              const active = current.startsWith(n.route);
              return (
                <TouchableOpacity
                  key={n.route}
                  testID={`admin-nav-${n.label.toLowerCase().split(" ")[0]}`}
                  onPress={() => router.push(n.route as any)}
                  style={[styles.navItem, active && styles.navItemActive, !isWide && styles.navItemMobile]}
                >
                  <Ionicons name={n.icon as any} color={active ? "#fff" : colors.textMuted} size={16} />
                  <Text style={[styles.navTxt, active && { color: "#fff" }]}>{n.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {isWide ? (
            <TouchableOpacity testID="admin-logout" onPress={logout} style={[styles.navItem, { marginTop: "auto" }]}>
              <Ionicons name="log-out" color={colors.danger} size={16} />
              <Text style={[styles.navTxt, { color: colors.danger }]}>Log out</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.contentHead}>
            <Text style={styles.title}>{title}</Text>
            {!isWide ? (
              <TouchableOpacity testID="admin-logout" onPress={logout}>
                <Ionicons name="log-out" color={colors.danger} size={20} />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.lg }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

export const adminStyles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadow.card },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text, fontSize: 14 },
});

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  row: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 240,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    padding: spacing.lg,
  },
  sidebarMobile: { width: "100%", padding: spacing.md, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.lg },
  brandIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  brandTxt: { fontWeight: "800", color: colors.text, fontSize: 15 },
  navItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.md, marginBottom: 4,
  },
  navItemActive: { backgroundColor: colors.brand },
  navItemMobile: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bg, marginBottom: 0 },
  navTxt: { color: colors.text, fontWeight: "600", fontSize: 13 },

  content: { flex: 1 },
  contentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, paddingBottom: 0 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
});
