import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/theme";

export function Toast({ message, type = "info" }: { message: string; type?: "info" | "success" | "error" }) {
  if (!message) return null;
  const bg =
    type === "success" ? colors.successBg : type === "error" ? colors.dangerBg : colors.infoBg;
  const fg =
    type === "success" ? colors.success : type === "error" ? colors.danger : colors.info;
  return (
    <View testID={`toast-${type}`} style={[styles.wrap, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={[styles.txt, { color: fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  txt: { fontWeight: "600", fontSize: 13 },
});
