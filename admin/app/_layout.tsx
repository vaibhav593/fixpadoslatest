import * as Font from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";

// Pre-warm vector-icon fonts so glyphs render in the very first frame on
// Android (Expo Go ships these fonts but they aren't loaded by default).
export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          ...(Ionicons as any).font,
          ...(MaterialIcons as any).font,
          ...(FontAwesome5 as any).font,
        });
      } catch {}
      setReady(true);
    })();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
