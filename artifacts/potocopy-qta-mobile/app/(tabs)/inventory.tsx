import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useListInventory } from '@workspace/api-client-react';
import type { InventoryItem } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { BrandHeader, Card, EmptyState, LoadingState, Pill, Screen, SearchInput } from '@/components/mobile-ui';

export default function InventoryScreen() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const query = useListInventory();
  const inventory = (query.data ?? []) as InventoryItem[];
  const filtered = useMemo(() => inventory.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase())), [inventory, search]);
  const statusColor = (status: InventoryItem['status']) => status === 'OUT' ? colors.destructive : status === 'LOW' ? colors.accent : colors.secondaryForeground;
  return (
    <Screen refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <BrandHeader title="Inventory" subtitle="Know what is ready, low, or out before the next rush." />
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search inventory" />
      {query.isLoading ? <LoadingState label="Loading inventory…" /> : query.isError ? <Card><EmptyState icon="wifi-off" title="Inventory unavailable" description="Try refreshing when the API is online." /></Card> : filtered.length ? <View style={styles.list}>{filtered.map(item => { const tone = statusColor(item.status); return <Card key={item.id} style={styles.item}><View style={[styles.icon, { backgroundColor: item.status === 'OUT' ? colors.destructive : colors.muted }]}><Feather name={item.status === 'OUT' ? 'alert-octagon' : 'package'} size={18} color={item.status === 'OUT' ? colors.destructiveForeground : colors.mutedForeground} /></View><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.sku} · minimum {item.minimumStock} {item.unit}</Text><Text style={[styles.stock, { color: tone }]}>{item.currentStock} {item.unit} on hand</Text></View><Pill label={item.status} color={tone} /></Card>; })}</View> : <Card><EmptyState icon="package" title="Inventory is empty" description="Stock items will appear here once they are configured." /></Card>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  stock: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});