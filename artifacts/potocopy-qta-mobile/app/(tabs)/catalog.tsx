import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useListProducts } from '@workspace/api-client-react';
import type { Product } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { BrandHeader, Card, EmptyState, LoadingState, Pill, Screen, SearchInput } from '@/components/mobile-ui';

export default function CatalogScreen() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const query = useListProducts();
  const products = (query.data ?? []) as Product[];
  const filtered = useMemo(() => products.filter(product => product.name.toLowerCase().includes(search.toLowerCase()) || product.sku.toLowerCase().includes(search.toLowerCase())), [products, search]);
  return (
    <Screen refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <BrandHeader title="Catalog" subtitle="Your active products and services, ready for the counter." />
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search catalog" />
      {query.isLoading ? <LoadingState label="Loading catalog…" /> : query.isError ? <Card><EmptyState icon="wifi-off" title="Catalog unavailable" description="Try refreshing when the API is online." /></Card> : filtered.length ? <View style={styles.list}>{filtered.map(product => <Card key={product.id} style={styles.item}><View style={[styles.icon, { backgroundColor: product.kind === 'SERVICE' ? colors.secondary : colors.muted }]}><Feather name={product.kind === 'SERVICE' ? 'printer' : 'package'} size={18} color={product.kind === 'SERVICE' ? colors.secondaryForeground : colors.mutedForeground} /></View><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{product.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{product.sku} · sold by {product.unit}</Text><Text style={[styles.price, { color: colors.primary }]}>{product.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.price) : 'Price not set'}</Text></View><Pill label={product.kind === 'SERVICE' ? 'SERVICE' : 'PRODUCT'} color={product.kind === 'SERVICE' ? colors.secondaryForeground : colors.primary} /></Card>)}</View> : <Card><EmptyState icon="search" title="No products found" description="Try a different name or SKU." /></Card>}
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
  price: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});