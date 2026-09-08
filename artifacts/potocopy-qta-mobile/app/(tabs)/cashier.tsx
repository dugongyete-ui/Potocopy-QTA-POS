import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  getGetDashboardSummaryQueryKey,
  getListTransactionsQueryKey,
  useCreateTransaction,
  useListProducts,
} from '@workspace/api-client-react';
import type { Product } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import {
  BrandHeader,
  Card,
  compactMoney,
  errorMessage,
  EmptyState,
  money,
  PrimaryButton,
  Screen,
  SearchInput,
  SectionTitle,
} from '@/components/mobile-ui';

type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER';
type Cart = Record<number, number>;

export default function CashierScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const productsQuery = useListProducts();
  const createTransaction = useCreateTransaction();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paid, setPaid] = useState('');
  const products = (productsQuery.data ?? []) as Product[];
  const filtered = useMemo(
    () => products.filter(product => product.name.toLowerCase().includes(search.toLowerCase()) || product.sku.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );
  const cartItems = products.filter(product => cart[product.id]).map(product => ({ product, quantity: cart[product.id] }));
  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const paidAmount = paymentMethod === 'CASH' ? Number(paid || 0) : total;

  const change = Math.max(0, paidAmount - total);
  const updateCart = (product: Product, delta: number) => {
    void Haptics.selectionAsync();
    setCart(current => {
      const next = Math.max(0, (current[product.id] ?? 0) + delta);
      const copy = { ...current };
      if (next === 0) delete copy[product.id];
      else copy[product.id] = next;
      return copy;
    });
  };
  const submit = () => {
    if (!cartItems.length) return;
    if (paymentMethod === 'CASH' && paidAmount < total) {
      Alert.alert('Payment is short', 'Enter enough cash to cover the total.');
      return;
    }
    createTransaction.mutate({
      data: {
        items: cartItems.map(item => ({ productId: item.product.id, quantity: item.quantity })),
        paymentMethod,
        paid: paidAmount,
      },
    }, {
      onSuccess: result => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCart({});
        setPaid('');
        void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 20 }) });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        Alert.alert('Sale saved', `${result.number} · ${compactMoney(result.total)}`);
      },
      onError: error => Alert.alert('Could not save sale', errorMessage(error, 'Please try again.')),
    });
  };

  return (
    <Screen>
      <BrandHeader title="New sale" subtitle="All active Catalog items are ready to sell. Store supplies stay in Inventory." />
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search product or SKU" />
      <SectionTitle title="Catalog" action={<Text style={[styles.count, { color: colors.mutedForeground }]}>{filtered.length} items</Text>} />
      {productsQuery.isLoading ? <View style={styles.loading}><Text style={[styles.helper, { color: colors.mutedForeground }]}>Loading catalog…</Text></View> : productsQuery.isError ? <Card><EmptyState icon="wifi-off" title="Catalog unavailable" description="Check the connection and try again." /></Card> : filtered.length ? (
        <View style={styles.productGrid}>
          {filtered.map(product => {
            const quantity = cart[product.id] ?? 0;
            return (
              <Pressable key={product.id} testID={`button-product-${product.id}`} onPress={() => updateCart(product, 1)} style={({ pressed }) => [styles.product, { backgroundColor: colors.card, borderColor: quantity ? colors.primary : colors.border, opacity: pressed ? 0.78 : 1 }]}>
                <View style={styles.productTop}>
                  <View style={[styles.productIcon, { backgroundColor: quantity ? colors.primary : colors.secondary }]}>
                    <Feather name={product.kind === 'SERVICE' ? 'printer' : 'paperclip'} size={16} color={quantity ? colors.primaryForeground : colors.secondaryForeground} />
                  </View>
                  {quantity ? <View style={[styles.quantityBadge, { backgroundColor: colors.primary }]}><Text style={[styles.quantityText, { color: colors.primaryForeground }]}>{quantity}</Text></View> : null}
                </View>
                <Text numberOfLines={2} style={[styles.productName, { color: colors.foreground }]}>{product.name}</Text>
                <Text style={[styles.productPrice, { color: colors.primary }]}>{compactMoney(product.price)} / {product.unit}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : <Card><EmptyState icon="search" title="No matching products" description="Try another product name or SKU." /></Card>}

      <SectionTitle title="Basket" action={cartItems.length ? <Text style={[styles.count, { color: colors.primary }]}>{cartItems.length} lines</Text> : undefined} />
      {cartItems.length ? <Card style={styles.basket}>
        {cartItems.map(({ product, quantity }) => (
          <View key={product.id} style={[styles.basketRow, { borderBottomColor: colors.border }]}>
            <View style={styles.rowCopy}><Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{product.name}</Text><Text style={[styles.helper, { color: colors.mutedForeground }]}>{compactMoney(product.price)} × {quantity}</Text></View>
            <Text style={[styles.lineTotal, { color: colors.foreground }]}>{compactMoney(product.price * quantity)}</Text>
            <View style={styles.stepper}><Pressable testID={`button-decrease-${product.id}`} onPress={() => updateCart(product, -1)} hitSlop={8}><Feather name="minus-circle" size={22} color={colors.mutedForeground} /></Pressable><Text style={[styles.stepperValue, { color: colors.foreground }]}>{quantity}</Text><Pressable testID={`button-increase-${product.id}`} onPress={() => updateCart(product, 1)} hitSlop={8}><Feather name="plus-circle" size={22} color={colors.primary} /></Pressable></View>
          </View>
        ))}
        <View style={styles.totalRow}><Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text><Text style={[styles.totalValue, { color: colors.primary }]}>{money(total)}</Text></View>
        <View style={styles.methods}><Text style={[styles.label, { color: colors.mutedForeground }]}>Payment</Text><View style={styles.methodRow}>{(['CASH', 'QRIS', 'TRANSFER'] as PaymentMethod[]).map(method => <Pressable key={method} testID={`button-payment-${method.toLowerCase()}`} onPress={() => setPaymentMethod(method)} style={[styles.method, { backgroundColor: paymentMethod === method ? colors.primary : colors.muted }]}><Text style={[styles.methodText, { color: paymentMethod === method ? colors.primaryForeground : colors.mutedForeground }]}>{method}</Text></Pressable>)}</View></View>
        {paymentMethod === 'CASH' ? <TextInput testID="input-cash-paid" value={paid} onChangeText={setPaid} keyboardType="numeric" placeholder="Cash received" placeholderTextColor={colors.mutedForeground} style={[styles.cashInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} /> : <Text style={[styles.helper, { color: colors.mutedForeground }]}>{paymentMethod === 'QRIS' ? 'QRIS is confirmed manually by the cashier.' : 'Transfer is confirmed manually by the cashier.'}</Text>}
        {paymentMethod === 'CASH' && paidAmount >= total ? <Text style={[styles.change, { color: colors.secondaryForeground }]}>Change {money(change)}</Text> : null}
        <PrimaryButton label={createTransaction.isPending ? 'Saving sale…' : 'Complete sale'} icon="check" disabled={createTransaction.isPending} onPress={submit} />
      </Card> : <Card><EmptyState icon="shopping-cart" title="Basket is empty" description="Tap a catalog item to add it to the sale." /></Card>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  loading: { minHeight: 110, alignItems: 'center', justifyContent: 'center' },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  product: { width: '48.5%', minHeight: 142, borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  productTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quantityBadge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quantityText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  productName: { fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, flex: 1 },
  productPrice: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  basket: { padding: 0, overflow: 'hidden' },
  basketRow: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowName: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  lineTotal: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepperValue: { fontFamily: 'Inter_700Bold', fontSize: 12, minWidth: 12, textAlign: 'center' },
  totalRow: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  totalValue: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  methods: { paddingHorizontal: 15, gap: 8 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  methodRow: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  methodText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  cashInput: { margin: 15, marginBottom: 5, minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontFamily: 'Inter_400Regular' },
  change: { paddingHorizontal: 15, paddingBottom: 8, fontFamily: 'Inter_700Bold', fontSize: 12 },
});