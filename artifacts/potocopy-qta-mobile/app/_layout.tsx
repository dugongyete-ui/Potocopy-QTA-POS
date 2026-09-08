import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ClerkProvider, useAuth, useSignIn } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton } from '@/components/mobile-ui';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return <>{children}</>;
}

function AuthenticatedApp() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Connecting to QTA…</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <SignInScreen />;
  }

  return (
    <ApiAuthBridge>
      <RootLayoutNav />
    </ApiAuthBridge>
  );
}

function SignInScreen() {
  const colors = useColors();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!isLoaded || !identifier.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setError('This account needs another verification step. Finish sign-in from the web app first.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your details and try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={[styles.authScreen, { backgroundColor: colors.background }]}>
      <View style={styles.authHeader}>
        <Text style={[styles.brand, { color: colors.primary }]}>POTOCOPY QTA</Text>
        <Text style={[styles.authTitle, { color: colors.foreground }]}>Run the counter from anywhere.</Text>
        <Text style={[styles.authSubtitle, { color: colors.mutedForeground }]}>Sign in to access sales, catalog, inventory, and backups.</Text>
      </View>
      <View style={styles.authForm}>
        <TextInput
          testID="input-auth-email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Email address"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.authInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />
        <TextInput
          testID="input-auth-password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.authInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />
        {error ? <Text style={[styles.authError, { color: colors.destructive }]}>{error}</Text> : null}
        <PrimaryButton label={pending ? 'Signing in…' : 'Sign in'} icon="log-in" disabled={pending} onPress={() => void submit()} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    setBaseUrl(domain ? `https://${domain}` : null);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return (
      <SafeAreaProvider>
        <View style={styles.configError}>
          <Text style={styles.configBrand}>POTOCOPY QTA</Text>
          <Text style={styles.configText}>Mobile auth is not configured.</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
                <AuthenticatedApp />
              </ClerkProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  authScreen: { flex: 1, paddingHorizontal: 18, paddingTop: 72, gap: 24 },
  authHeader: { gap: 8 },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.6 },
  authTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 34 },
  authSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  authForm: { gap: 10 },
  authInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 14 },
  authError: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  configError: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#f8f4ee' },
  configBrand: { color: '#df5d2f', fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.6 },
  configText: { color: '#6d7b7d', fontFamily: 'Inter_500Medium', fontSize: 13 },
});
