import { StyleSheet, Text, useColorScheme, View } from "react-native";

import { radius, theme } from "@/lib/theme";

export default function Home() {
  const colors = theme(useColorScheme());

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.eyebrow, { color: colors["muted-foreground"] }]}>
        MOBILE SHELL
      </Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        The native client starts here.
      </Text>
      <Text style={[styles.body, { color: colors["muted-foreground"] }]}>
        Colours come from @saas/design-tokens, the same tokens the web reads.
        Components are not shared — @saas/ui is Base UI and Tailwind — but the
        decisions are, so the two clients cannot drift apart.
      </Text>
      <View
        style={[
          styles.swatchRow,
          { borderColor: colors.border, borderRadius: radius.lg },
        ]}
      >
        {(["primary", "destructive", "muted", "foreground"] as const).map(
          (token) => (
            <View
              key={token}
              style={[styles.swatch, { backgroundColor: colors[token] }]}
            />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  eyebrow: { fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  title: { fontSize: 30, fontWeight: "700", lineHeight: 36 },
  body: { fontSize: 15, lineHeight: 22 },
  swatchRow: { borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 12, padding: 12 },
  swatch: { borderRadius: 6, height: 36, width: 36 },
});
