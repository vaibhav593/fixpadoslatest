import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function RoleSelect() {
  const router = useRouter();
  const [role, setRole] = useState<"customer" | "worker">("customer");

  const proceed = async () => {
    await storage.setItem("hm_role_intent", role);
    router.push("/register");
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <LinearGradient
        colors={[colors.gradStart, colors.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.brand}>
          <Ionicons name="home" color="#fff" size={22} />
          <Text style={styles.brandTxt}>FixPados</Text>
        </View>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Reliable Local Services{"\n"}At Your Doorstep</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.q}>Continue as</Text>

        <TouchableOpacity
          testID="role-customer-card"
          activeOpacity={0.9}
          onPress={() => setRole("customer")}
          style={[styles.card, role === "customer" && styles.cardActive, shadow.card]}
        >
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=200&q=80",
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={styles.cardSub}>Book trusted local pros in minutes</Text>
          </View>
          <Ionicons
            name={role === "customer" ? "radio-button-on" : "radio-button-off"}
            size={22}
            color={role === "customer" ? colors.brand : colors.textFaint}
          />
        </TouchableOpacity>

        <TouchableOpacity
          testID="role-worker-card"
          activeOpacity={0.9}
          onPress={() => setRole("worker")}
          style={[styles.card, role === "worker" && styles.cardActive, shadow.card]}
        >
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=200&q=80",
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Worker</Text>
            <Text style={styles.cardSub}>Get jobs near you, grow your business</Text>
          </View>
          <Ionicons
            name={role === "worker" ? "radio-button-on" : "radio-button-off"}
            size={22}
            color={role === "worker" ? colors.brand : colors.textFaint}
          />
        </TouchableOpacity>

        <View style={{ marginTop: "auto" }}>
          <Button
            testID="role-continue-button"
            label="Continue"
            icon="arrow-forward"
            onPress={proceed}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + 24,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  brand: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: spacing.lg },
  brandTxt: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: 0.3 },
  title: { color: "#fff", fontWeight: "800", fontSize: 30 },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 8, lineHeight: 20 },

  body: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  q: { fontSize: 13, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardActive: { borderColor: colors.brand },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
