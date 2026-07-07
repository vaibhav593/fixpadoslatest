import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api, setCachedUser, setToken } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!password) return setErr("Enter admin password");
    setLoading(true);
    try {
      const res = await api.adminLogin(password);
      await setToken(res.token);
      await setCachedUser(res.user);
      router.replace("/dashboard");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={{ flex: 1, justifyContent: "center" }}>
        <View style={styles.card}>
          <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={styles.hero}>
            <Ionicons name="shield-checkmark" color="#fff" size={28} />
            <Text style={styles.heroTitle}>FixPados Admin</Text>
            <Text style={styles.heroSub}>Sign in to manage the platform</Text>
          </LinearGradient>

          <View style={{ padding: spacing.lg }}>
            <Text style={styles.label}>Admin Password</Text>
            <TextInput
              testID="admin-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={styles.input}
              onSubmitEditing={submit}
            />
            <Text style={styles.help}>Default password is <Text style={{ fontWeight: "700" }}>admin123</Text> (change `ADMIN_PASSWORD` in backend/.env)</Text>
            {err ? <Toast type="error" message={err} /> : null}
            <View style={{ marginTop: spacing.md }}>
              <Button testID="admin-login-button" label="Sign In" icon="log-in" onPress={submit} loading={loading} />
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  card: {
    alignSelf: "center", width: "100%", maxWidth: 420,
    backgroundColor: colors.surface, borderRadius: radius.xxl,
    overflow: "hidden", marginHorizontal: spacing.lg,
  },
  hero: { padding: spacing.xl, alignItems: "center", gap: 4 },
  heroTitle: { color: "#fff", fontWeight: "800", fontSize: 20, marginTop: 6 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  label: { fontWeight: "800", color: colors.textMuted, fontSize: 12, letterSpacing: 0.6, marginBottom: 6 },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text, fontSize: 15 },
  help: { fontSize: 11, color: colors.textFaint, marginTop: 6 },
});
