import { DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/ui/splash-overlay';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ThemeProvider value={DefaultTheme}>
        <QueryClientProvider client={queryClient}>
          <AnimatedSplashOverlay />
          <Slot />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
