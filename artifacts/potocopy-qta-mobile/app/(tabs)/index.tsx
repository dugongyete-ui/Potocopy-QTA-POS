import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useGetActivity,
  useGetDashboardSummary,
  useListInventory,
  useListTransactions,
} from '@workspace/api-client-react';
import type { Activity, DashboardSummary, InventoryItem, Transaction } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import {
  BrandHeader,
  Card,
  compactMoney,
  dateTime,
  EmptyState,
  ErrorState,
  LoadingState,
  money,
  Pill,
  Screen,
  SectionTitle,
  StatCard,
} from '@/components/mobile-ui';

export default function HomeScreen() {
  const colors = useColors();
  const summaryQuery = useGetDashboardSummary();
  const activityQuery = useGetActivity({ limit: 5 });
  const transactionsQuery = useListTransactions({ limit: 4 });
  const inventoryQuery = useListInventory();
  const summary = summaryQuery.data as DashboardSummary | undefined;
  const activities = (activityQuery.data ?? []) as Activity[];
  const transactions = (transactionsQuery.data ?? []) as Transaction[];
  const inventory = (inventoryQuery.data ?? []) as InventoryItem[];
  const refresh = () => {
    void summaryQuery.refetch();
    void activityQuery.refetch();
    void transactionsQuery.refetch();
    void inventoryQuery.refetch();
  };

  return (
    <Screen refreshing={summaryQuery.isFetching} onRefresh={refresh}>
      <BrandHeader
        title="Counter overview"
        subtitle="A clear view of today’s shop pulse."
        right={
          <Pressable
            testID="button-open-more"
            onPress={() => router.push('/(tabs)/more')}
            style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }, styles.moreButton]}
          >
            <Feather name="more-horizontal" size={22} color={colors.foreground} />
          </Pressable>
        }
      />

      {summaryQuery.isLoading ? <LoadingState /> : summaryQuery.isError ? <ErrorState message="Dashboard data could not be loaded." onRetry={refresh} /> : (
        <>
          <Card style={[styles.hero, { backgroundColor: colors.foreground }]}>
            <View style={styles.heroTop}>
              <View>
                <Text style={[styles.heroEyebrow, { color: colors.primary }]}>{summary?.date ?? 'TODAY'}</Text>
                <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>Today at QTA</Text>
              </View>
              <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
                <Feather name="trending-up" size={20} color={colors.primaryForeground} />
              </View>
            </View>
            <Text style={[styles.heroValue, { color: colors.primaryForeground }]}>{money(summary?.revenueToday ?? 0)}</Text>
            <Text style={[styles.heroHelper, { color: colors.mutedForeground }]}>
              {summary?.transactionCount ?? 0} paid transactions · net {compactMoney(summary?.netCash ?? 0)}
            </Text>
          </Card>

          <View style={styles.statRow}>
            <StatCard label="Avg. ticket" value={compactMoney(summary?.averageTransaction ?? 0)} helper="Per transaction" icon="file-text" />
            <StatCard label="Expenses" value={compactMoney(summary?.expensesToday ?? 0)} helper="Cash out today" icon="arrow-down-right" tone="accent" />
          </View>

          <View style={styles.quickRow}>
            <Pressable testID="button-quick-cashier" onPress={() => router.push('/(tabs)/cashier')} style={({ pressed }) => [styles.quick, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
              <Feather name="shopping-cart" size={18} color={colors.primaryForeground} />
              <Text style={[styles.quickText, { color: colors.primaryForeground }]}>New sale</Text>
            </Pressable>
            <Pressable testID="button-quick-inventory" onPress={() => router.push('/(tabs)/inventory')} style={({ pressed }) => [styles.quick, { backgroundColor: colors.secondary, opacity: pressed ? 0.85 : 1 }]}>
              <Feather name="package" size={18} color={colors.secondaryForeground} />
              <Text style={[styles.quickText, { color: colors.secondaryForeground }]}>Check stock</Text>
            </Pressable>
          </View>

          <SectionTitle title="Needs attention" />
          {inventory.filter(item => item.status !== 'HEALTHY').length ? (
            <Card style={styles.listCard}>
              {inventory.filter(item => item.status !== 'HEALTHY').slice(0, 3).map(item => (
                <View key={item.id} style={[styles.listRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.rowIcon, { backgroundColor: item.status === 'OUT' ? colors.destructive : colors.accent }]}>
                    <Feather name={item.status === 'OUT' ? 'alert-octagon' : 'alert-triangle'} size={16} color={item.status === 'OUT' ? colors.destructiveForeground : colors.accentForeground} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{item.currentStock} {item.unit} remaining</Text>
                  </View>
                  <Pill label={item.status === 'OUT' ? 'OUT' : 'LOW'} color={item.status === 'OUT' ? colors.destructive : colors.accent} />
                </View>
              ))}
            </Card>
          ) : <Card><EmptyState icon="check-circle" title="Stock looks healthy" description="No low-stock items need attention today." /></Card>}

          <SectionTitle title="Recent sales" action={<Pressable onPress={() => router.push('/(tabs)/cashier')}><Text style={[styles.link, { color: colors.primary }]}>Open cashier</Text></Pressable>} />
          {transactions.length ? (
            <Card style={styles.listCard}>
              {transactions.map(transaction => (
                <View key={transaction.id} style={[styles.listRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name="file-text" size={16} color={colors.secondaryForeground} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{transaction.number}</Text>
                    <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{dateTime(transaction.createdAt)} · {transaction.paymentMethod}</Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: colors.foreground }]}>{compactMoney(transaction.total)}</Text>
                </View>
              ))}
            </Card>
          ) : <Card><EmptyState icon="file-text" title="No sales yet" description="Completed sales will appear here." /></Card>}

          <SectionTitle title="Activity" />
          {activities.length ? (
            <Card style={styles.listCard}>
              {activities.slice(0, 4).map(item => (
                <View key={item.id} style={[styles.activityRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.action}</Text>
                    <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{item.detail} · {dateTime(item.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : <Card><EmptyState icon="activity" title="No activity yet" description="Important shop actions will be logged here." /></Card>}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  moreButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 18, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 3 },
  heroIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroValue: { fontFamily: 'Inter_700Bold', fontSize: 29, marginTop: 6 },
  heroHelper: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  statRow: { flexDirection: 'row', gap: 10 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, minHeight: 50, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  quickText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  listCard: { padding: 0, overflow: 'hidden' },
  listRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  rowMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  rowAmount: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  link: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  activityRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
});
