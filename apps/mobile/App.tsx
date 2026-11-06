import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./auth/AuthContext";
import ConnectivityBanner from "./ui/ConnectivityBanner";
import { DrawerProvider } from "./navigation/drawer";
import { navigationRef } from "./navigation/navRef";
import { RootNavigator } from "./navigation/RootNavigator";
import { initStore } from "./store/tinybase";
import { colors } from "./theme/theme";
import { TourProvider } from "./tour/TourProvider";

interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text, marginBottom: 12 }}>App Notice</Text>
          <Text style={{ fontSize: 14, color: colors.danger, textAlign: "center", marginBottom: 20 }}>
            {this.state.error?.message || "An unexpected error occurred while loading."}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border },
};

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Open the local SQLite-backed TinyBase store before rendering screens.
    initStore()
      .catch((err) => {
        console.warn("initStore failed:", err);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <DrawerProvider>
            <ConnectivityBanner />
            <NavigationContainer ref={navigationRef} theme={navTheme}>
              <TourProvider>
                <RootNavigator />
              </TourProvider>
            </NavigationContainer>
          </DrawerProvider>
        </AuthProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
