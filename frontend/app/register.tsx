import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api, setCachedUser, setToken } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<"customer" | "worker">("customer");

  useEffect(() => {
    (async () => {
      const r = await storage.getItem<string>("hm_role_intent", "customer");
      setRole((r as "customer" | "worker") || "customer");
    })();
  }, []);

  const submit = async () => {
    setError("");
    const cleanName = name.trim();
    const cleanMobile = mobile.replace(/\D/g, "");
    if (cleanName.length < 2) {
      setError("Please enter your full name");
      return;
    }
    if (cleanMobile.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const res = await api.register(cleanName, "+91" + cleanMobile, role);
      await setToken(res.token);
      await setCachedUser(res.user);
      if (res.user.role === "worker") {
        const status = (res.user as { kyc_status?: string }).kyc_status;
        if (status === "approved") router.replace("/(worker)/jobs");
        else if (status === "submitted") router.replace("/worker-pending");
        else if (status === "rejected") router.replace("/worker-rejected");
        // "pending" (never submitted) → must complete full profile first.
        else router.replace("/worker-onboarding");
      } else {
        router.replace("/(customer)/home");
      }
    } catch (e) {
      const err = e as Error;
      setError(err.message || "Could not register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} bottomOffset={32}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Tell us about{"\n"}yourself</Text>
        <Text style={styles.subtitle}>
          We&apos;ll use this to set up your {role === "worker" ? "worker" : "customer"} account.
        </Text>

        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="person-outline" size={18} color={colors.textMuted} />
          <TextInput
            testID="register-name-input"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Priya Sharma"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCapitalize="words"
            autoFocus
            returnKeyType="next"
          />
        </View>

        <Text style={styles.label}>Mobile Number</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.cc}>+91</Text>
          <View style={styles.sep} />
          <TextInput
            testID="register-mobile-input"
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))}
            placeholder="98765 43210"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>

        <View style={styles.roleRow}>
          <Text style={styles.roleHint}>Continuing as</Text>
          <View style={styles.rolePill}>
            <Ionicons
              name={role === "worker" ? "construct" : "person"}
              size={13}
              color={colors.brand}
            />
            <Text style={styles.rolePillTxt}>
              {role === "worker" ? "Worker" : "Customer"}
            </Text>
          </View>
        </View>

        {error ? <Toast type="error" message={error} /> : null}

        <View style={{ marginTop: spacing.xl }}>
          <Button
            testID="register-submit-button"
            label="Create Account"
            icon="arrow-forward"
            onPress={submit}
            loading={loading}
          />
        </View>

        <Text style={styles.help} testID="register-helper">
          By continuing you agree to our Terms & Privacy Policy.
        </Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, lineHeight: 32 },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  cc: { fontSize: 16, fontWeight: "700", color: colors.text },
  sep: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 14, fontWeight: "600" },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  roleHint: { color: colors.textMuted, fontSize: 13 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  rolePillTxt: { color: colors.brandDark, fontWeight: "700", fontSize: 12 },
  help: { textAlign: "center", color: colors.textFaint, marginTop: spacing.lg, fontSize: 12 },
});
