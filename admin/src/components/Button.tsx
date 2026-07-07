import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, radius, spacing } from "@/src/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  testID,
  disabled,
  loading,
  fullWidth = true,
  small,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  small?: boolean;
}) {
  const palette =
    variant === "primary"
      ? { bg: colors.brand, fg: "#fff", border: colors.brand }
      : variant === "secondary"
      ? { bg: colors.brandLight, fg: colors.brandDark, border: colors.brandLight }
      : variant === "danger"
      ? { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg }
      : { bg: "transparent", fg: colors.text, border: colors.border };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled || loading ? 0.6 : 1,
          paddingVertical: small ? 10 : 14,
        },
        fullWidth && { alignSelf: "stretch" },
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={palette.fg} /> : null}
      <Text style={[styles.label, { color: palette.fg, fontSize: small ? 13 : 15 }]}>
        {loading ? "Please wait..." : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  label: { fontWeight: "700", letterSpacing: 0.2 },
});
