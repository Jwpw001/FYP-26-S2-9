import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View, ActivityIndicator } from "react-native";
import { getUser, clearUser } from "../utils/auth";
import { AuthContext } from "../context/AuthContext";
export { useAuth } from "../context/AuthContext";

// Screens
import LoginScreen from "../screens/LoginScreen";

// Regular staff
import StaffDashboard from "../screens/regular-staff/Dashboard";
import StaffMyShifts from "../screens/regular-staff/MyShifts";
import StaffLeave from "../screens/regular-staff/LeaveRequests";
import StaffSwaps from "../screens/regular-staff/SwapRequests";

// Casual staff
import CasualDashboard from "../screens/casual-staff/Dashboard";
import CasualMyShifts from "../screens/casual-staff/MyShifts";
import CasualAvailability from "../screens/casual-staff/WeeklyAvailability";

// Krewby worker
import WorkerDashboard from "../screens/krewby-worker/Dashboard";
import WorkerMyJobs from "../screens/krewby-worker/MyJobs";
import WorkerAvailability from "../screens/krewby-worker/Availability";

// Shared
import NotificationsScreen from "../screens/shared/Notifications";

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.55 }}>
      {emoji}
    </Text>
  );
}

const TAB_OPTS = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: "#0F172A",
    borderTopColor: "rgba(255,255,255,0.08)",
    height: 64,
    paddingBottom: 10,
    paddingTop: 6,
  },
  tabBarActiveTintColor: "#60A5FA",
  tabBarInactiveTintColor: "rgba(255,255,255,0.45)",
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
};

function RegularStaffTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_OPTS}>
      <Tab.Screen name="Dashboard" component={StaffDashboard}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="My Shifts" component={StaffMyShifts}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} /> }} />
      <Tab.Screen name="Leave" component={StaffLeave}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏖" focused={focused} /> }} />
      <Tab.Screen name="Swaps" component={StaffSwaps}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔄" focused={focused} /> }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function CasualStaffTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_OPTS}>
      <Tab.Screen name="Dashboard" component={CasualDashboard}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="My Shifts" component={CasualMyShifts}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} /> }} />
      <Tab.Screen name="Availability" component={CasualAvailability}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📆" focused={focused} /> }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function KrewbyWorkerTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_OPTS}>
      <Tab.Screen name="Dashboard" component={WorkerDashboard}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="My Jobs" component={WorkerMyJobs}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💼" focused={focused} /> }} />
      <Tab.Screen name="Availability" component={WorkerAvailability}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📆" focused={focused} /> }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function RoleNavigator({ role }) {
  if (role === "regular_staff") return <RegularStaffTabs />;
  if (role === "outlet_casual_staff") return <CasualStaffTabs />;
  if (role === "krewby_worker") return <KrewbyWorkerTabs />;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#64748B", fontSize: 14 }}>
        Role "{role}" is not supported on mobile.
      </Text>
    </View>
  );
}

export default function AppNavigator() {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUser().then((u) => { setUserState(u); setLoading(false); });
  }, []);

  const authContext = {
    user,
    signIn: (profile) => setUserState(profile),
    signOut: async () => { await clearUser(); setUserState(null); },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContext}>
      {!user ? (
        <LoginScreen />
      ) : (
        <NavigationContainer>
          <RoleNavigator role={user.role} />
        </NavigationContainer>
      )}
    </AuthContext.Provider>
  );
}
