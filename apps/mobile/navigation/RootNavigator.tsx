import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import { HamburgerButton } from "./drawer";
import { LockScreen } from "../screens/LockScreen";
import { AccountScreen } from "../screens/AccountScreen";
import { AddObservationScreen } from "../screens/AddObservationScreen";
import { BimModelsScreen } from "../screens/BimModelsScreen";
import { BoQProgressScreen } from "../screens/BoQProgressScreen";
import { CaptureScreen } from "../capture/CaptureScreen";
import { DailyLogScreen } from "../screens/DailyLogScreen";
import { DroneDatasetsScreen } from "../screens/DroneDatasetsScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MilestoneDetailScreen } from "../screens/MilestoneDetailScreen";
import { MilestonesScreen } from "../screens/MilestonesScreen";
import { ProjectHubScreen } from "../screens/ProjectHubScreen";
import { ProjectsScreen } from "../screens/ProjectsScreen";
import { QualityTestsScreen } from "../screens/QualityTestsScreen";
import { ReportsScreen } from "../screens/ReportsScreen";
import { TicketsScreen } from "../screens/TicketsScreen";
import { colors } from "../theme/theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.bg },
};

/** The Projects flow (drill-down): list → milestone → capture / observe / report. */
function ProjectsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{ headerLeft: () => <HamburgerButton /> }}
      />
      <Stack.Screen name="ProjectHub" component={ProjectHubScreen} options={{ title: "Project" }} />
      <Stack.Screen name="Milestones" component={MilestonesScreen} options={{ title: "Milestones" }} />
      <Stack.Screen name="MilestoneDetail" component={MilestoneDetailScreen} options={{ title: "Milestone" }} />
      <Stack.Screen name="Capture" component={CaptureScreen} options={{ title: "Capture evidence" }} />
      <Stack.Screen name="AddObservation" component={AddObservationScreen} options={{ title: "Observation" }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: "Reports" }} />
      <Stack.Screen name="DailyLog" component={DailyLogScreen} options={{ title: "Site Diary" }} />
      <Stack.Screen name="BoQProgress" component={BoQProgressScreen} options={{ title: "BoQ Progress" }} />
      <Stack.Screen name="QualityTests" component={QualityTestsScreen} options={{ title: "Quality Tests" }} />
      <Stack.Screen name="BimModels" component={BimModelsScreen} options={{ title: "BIM Models" }} />
      <Stack.Screen name="DroneDatasets" component={DroneDatasetsScreen} options={{ title: "Drone Datasets" }} />
      <Stack.Screen name="Tickets" component={TicketsScreen} options={{ title: "Tickets & Snags" }} />
    </Stack.Navigator>
  );
}

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated, restoring, locked } = useAuth();
  if (restoring) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  // A stored session that hasn't been biometric-unlocked this launch.
  if (locked && !isAuthenticated) return <LockScreen />;
  if (!isAuthenticated) return <AuthFlow />;

  return (
    // Bottom tab bar is hidden — navigation is the left drawer (opened by the
    // header hamburger). The tab navigator still owns the two top-level
    // sections and their state; we just drive it from the drawer.
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tab.Screen name="Home" component={ProjectsStack} options={{ title: "Projects" }} />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          headerShown: true,
          ...stackOptions,
          headerLeft: () => <HamburgerButton />,
        }}
      />
    </Tab.Navigator>
  );
}
