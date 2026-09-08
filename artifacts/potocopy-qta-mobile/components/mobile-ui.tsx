import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export const money = (value = 0) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);

export const compactMoney = (value = 0) =>
  value >= 1_000_000
    ? `Rp ${(value / 1_000_000).toFixed(1)} jt`
    : value >= 1_000
      ? `Rp ${(value / 1_000).toFixed(1)} rb`
      : money(value);

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type ScreenProps = ScrollViewProps & {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
};

export function Screen({
  children,
  refreshing = false,
  onRefresh,
  contentStyle,
  ...props
}: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  return (
    <ScrollView
      {...props}
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.screenContent,
        { paddingTop: topInset + 12, paddingBottom: bottomInset + 28 },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function BrandHeader({
  eyebrow = 'POTOCOPY QTA',
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <View style={styles.brandLine}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Ionicons name="print-outline" size={18} color={colors.primaryForeground} />
            <View style={[styles.logoDot, { backgroundColor: colors.accent }]} />
          </View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={`button-${label.replace(/\s+/g, '-').toLowerCase()}`}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
    >
      <Feather name={icon} size={21} color={colors.foreground} />
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function StatCard({
  label,
  value,
  helper,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string;
  helper?: string;
  icon: keyof typeof Feather.glyphMap;
  tone?: 'primary' | 'accent' | 'teal';
}) {
  const colors = useColors();
  const tint = tone === 'accent' ? colors.accent : tone === 'teal' ? colors.secondaryForeground : colors.primary;
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint, opacity: 0.92 }]}>
        <Feather name={icon} size={17} color={tone === 'accent' ? colors.accentForeground : colors.primaryForeground} />
      </View>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      {helper ? <Text style={[styles.statHelper, { color: colors.mutedForeground }]}>{helper}</Text> : null}
    </Card>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>{title}</Text>
      {action}
    </View>
  );
}

export function Pill({ label, color }: { label: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: color ?? colors.muted }]}>
      <Text style={[styles.pillText, { color: color ? colors.primaryForeground : colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const colors = useColors();
  const backgroundColor = secondary ? colors.secondary : colors.primary;
  const foregroundColor = secondary ? colors.secondaryForeground : colors.primaryForeground;
  return (
    <Pressable
      testID={`button-${label.replace(/\s+/g, '-').toLowerCase()}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.82 : 1 },
      ]}
    >
      {icon ? <Feather name={icon} size={17} color={foregroundColor} /> : null}
      <Text style={[styles.primaryButtonText, { color: foregroundColor }]}>{label}</Text>
    </Pressable>
  );
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const colors = useColors();
  return (
    <TextInput
      testID="input-search"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      style={[
        styles.input,
        { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
      ]}
    />
  );
}

export function LoadingState({ label = 'Loading QTA data…' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.centerState}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <Card style={styles.stateCard}>
      <Feather name="alert-circle" size={24} color={colors.destructive} />
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>Something went wrong</Text>
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{message}</Text>
      <PrimaryButton label="Try again" icon="refresh-cw" onPress={onRetry} secondary />
    </Card>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={22} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenContent: { paddingHorizontal: 18, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 7 },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, right: 3, bottom: 3 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 27, letterSpacing: -0.6 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  statCard: { flex: 1, minWidth: 145, padding: 14 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 1 },
  statHelper: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  sectionHeading: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  primaryButton: { minHeight: 46, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontFamily: 'Inter_400Regular', fontSize: 14 },
  centerState: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 12 },
  stateCard: { alignItems: 'center', paddingVertical: 24 },
  stateTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, textAlign: 'center' },
  stateText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 30, paddingHorizontal: 18 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
});