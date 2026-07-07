import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, getCachedUser } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

export default function Chat() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [me, setMe] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const lastTime = useRef<string | undefined>(undefined);
  const listRef = useRef<FlatList>(null);

  const poll = useCallback(async () => {
    try {
      const items = await api.listMessages(bookingId, lastTime.current);
      if (items.length) {
        setMessages((p) => [...p, ...items]);
        lastTime.current = items[items.length - 1].created_at;
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch {}
  }, [bookingId]);

  useEffect(() => {
    (async () => setMe(await getCachedUser()))();
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [poll]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      const m = await api.sendMessage(bookingId, t);
      setMessages((p) => [...p, m]);
      lastTime.current = m.created_at;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {} finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Conversation</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "translate-with-padding"}
        keyboardVerticalOffset={16}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.sender_id === me?.id;
            return (
              <View
                testID={`message-${item.id}`}
                style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                ]}
              >
                <Text style={[styles.bubbleTxt, mine && { color: "#fff" }]}>{item.text}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 32 }}>
              No messages yet. Say hi 👋
            </Text>
          }
        />

        <View style={[styles.composer, shadow.pop]}>
          <TextInput
            testID="chat-message-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={colors.textFaint}
            style={styles.composerInput}
            multiline
          />
          <TouchableOpacity
            testID="chat-send-button"
            onPress={send}
            style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" color="#fff" size={18} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },

  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.brand, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  bubbleTxt: { color: colors.text, fontSize: 14 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  composerInput: {
    flex: 1,
    minHeight: 44, maxHeight: 120,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingTop: 10, paddingBottom: 10,
    fontSize: 14, color: colors.text,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
});
