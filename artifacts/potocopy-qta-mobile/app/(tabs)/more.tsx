import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/clerk-expo';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  exportBackup,
  getGetDashboardSummaryQueryKey,
  getGetActivityQueryKey,
  getListExpensesQueryKey,
  importBackup,
  useCreateExpense,
  useDeleteExpense,
  useListExpenses,
} from '@workspace/api-client-react';
import type { BackupSnapshot, Expense } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BrandHeader, Card, dateTime, EmptyState, errorMessage, Pill, PrimaryButton, Screen, SectionTitle } from '@/components/mobile-ui';

export default function MoreScreen() {
  const colors = useColors();
  const { user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const expensesQuery = useListExpenses();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Operasional');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const expenses = (expensesQuery.data ?? []) as Expense[];

  const refresh = () => {
    void expensesQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };
  const saveExpense = () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !description.trim()) {
      setNotice('Enter a valid amount and description.');
      return;
    }
    createExpense.mutate({ data: { amount: numericAmount, category, description: description.trim() } }, {
      onSuccess: () => {
        setAmount('');
        setDescription('');
        setNotice('Expense recorded.');
        refresh();
        void queryClient.invalidateQueries({ queryKey: getGetActivityQueryKey({ limit: 8 }) });
      },
      onError: error => setNotice(errorMessage(error, 'Expense could not be recorded.')),
    });
  };
  const removeExpense = (expense: Expense) => Alert.alert('Delete expense?', expense.description, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteExpense.mutate({ id: expense.id }, { onSuccess: refresh, onError: error => setNotice(errorMessage(error, 'Expense could not be deleted.')) }) }]);
  const downloadBackup = async () => {
    setBusy('download');
    setNotice('');
    try {
      const snapshot = await exportBackup();
      const file = new File(Paths.cache, `potocopy-qta-backup-${new Date().toISOString().slice(0, 10)}.json`);
      file.write(JSON.stringify(snapshot, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Potocopy QTA backup' });
        setNotice('Backup siap dibagikan atau disimpan ke perangkat.');
      } else {
        setNotice(`Backup tersimpan di ${file.uri}`);
      }
    } catch (error) {
      setNotice(errorMessage(error, 'Backup could not be created.'));
    } finally {
      setBusy('');
    }
  };
  const restoreBackup = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    Alert.alert('Replace shop data?', 'Restore will replace the current shop data with this JSON backup.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', onPress: async () => {
      setBusy('restore');
      setNotice('');
      try {
        const file = new File(result.assets[0].uri);
        const snapshot = JSON.parse(await file.text()) as BackupSnapshot;
        await importBackup(snapshot);
        await queryClient.invalidateQueries();
        setNotice('Backup restored successfully.');
      } catch (error) {
        setNotice(errorMessage(error, 'Backup could not be restored.'));
      } finally {
        setBusy('');
      }
    } }]);
  };

  return (
    <Screen refreshing={expensesQuery.isFetching} onRefresh={refresh}>
      <BrandHeader title="More" subtitle="Expenses, backups, and account controls." />
      <Card style={styles.account}><View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{(user?.firstName?.[0] ?? user?.emailAddresses[0]?.emailAddress[0] ?? 'Q').toUpperCase()}</Text></View><View style={styles.copy}><Text style={[styles.accountName, { color: colors.foreground }]}>{user?.fullName ?? 'QTA account'}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}</Text></View><Pressable onPress={() => void signOut()} testID="button-sign-out" hitSlop={8}><Feather name="log-out" size={19} color={colors.mutedForeground} /></Pressable></Card>

      <SectionTitle title="Record expense" />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextInput testID="input-mobile-expense-amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Amount in IDR" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
        <TextInput testID="input-mobile-expense-category" value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
        <TextInput testID="input-mobile-expense-description" value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
        <PrimaryButton label={createExpense.isPending ? 'Saving…' : 'Save expense'} icon="plus" disabled={createExpense.isPending} onPress={saveExpense} />
      </KeyboardAwareScrollViewCompat>
      {notice ? <Text style={[styles.notice, { color: colors.primary }]}>{notice}</Text> : null}

      <SectionTitle title="Recent expenses" />
      {expenses.length ? <Card style={styles.expenseList}>{expenses.slice(0, 8).map(expense => <View key={expense.id} style={[styles.expenseRow, { borderBottomColor: colors.border }]}><View style={styles.copy}><Text style={[styles.expenseDescription, { color: colors.foreground }]}>{expense.description}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{expense.category} · {dateTime(expense.createdAt)}</Text></View><View style={styles.expenseRight}><Text style={[styles.expenseAmount, { color: colors.destructive }]}>−{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(expense.amount)}</Text><Feather.Button name="trash-2" size={14} color={colors.destructive} backgroundColor="transparent" underlayColor="transparent" onPress={() => removeExpense(expense)} /></View></View>)}</Card> : <Card><EmptyState icon="clipboard" title="No expenses yet" description="Saved shop expenses will appear here." /></Card>}

      <SectionTitle title="Backup & restore" />
      <Card style={styles.backup}><View style={[styles.backupIcon, { backgroundColor: colors.secondary }]}><Feather name="database" size={20} color={colors.secondaryForeground} /></View><Text style={[styles.backupTitle, { color: colors.foreground }]}>Portable shop data</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Export catalog, stock, sales, payments, expenses, and activity logs as JSON.</Text><PrimaryButton label={busy === 'download' ? 'Preparing…' : 'Download backup JSON'} icon="download" disabled={!!busy} onPress={() => void downloadBackup()} /><PrimaryButton label={busy === 'restore' ? 'Restoring…' : 'Restore from JSON'} icon="upload" secondary disabled={!!busy} onPress={() => void restoreBackup()} /><Pill label="Restore replaces current data" color={colors.accent} /></Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  copy: { flex: 1, gap: 3 },
  accountName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  form: { gap: 10, paddingBottom: 2 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontFamily: 'Inter_400Regular', fontSize: 14 },
  notice: { fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 17 },
  expenseList: { padding: 0, overflow: 'hidden' },
  expenseRow: { minHeight: 66, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  expenseDescription: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  expenseRight: { alignItems: 'flex-end', gap: 2 },
  expenseAmount: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  backup: { gap: 10 },
  backupIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backupTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});