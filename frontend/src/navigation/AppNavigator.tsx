import React, { useEffect, useRef } from 'react';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/themeContext';
import { useAuth } from '../context/AuthContext';
import { Home as HomePage } from '../pages/Home';
import { RecordModule } from '../pages/RecordModule';
import { Assets } from '../pages/Assets';
import { Discover } from '../pages/Discover';
import { Profile } from '../pages/Profile';
import { DreamDetail } from '../pages/DreamDetail';
import { ScriptToVideo } from '../pages/ScriptToVideo';
import { ScriptViewer } from '../pages/ScriptViewer';
import { CreationCenter } from '../pages/CreationCenter';
import { ImageViewer } from '../pages/ImageViewer';
import { VideoPlayer } from '../pages/VideoPlayer';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { Subscription } from '../pages/Subscription';
import { PsychologicalTest } from '../pages/PsychologicalTest';
import { ThemeSettings } from '../pages/ThemeSettings';
import { ActivityIndicator, View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

// 底部导航栏图标组件
const DreamIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      fill={color}
    />
  </Svg>
);

const RecordIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76z"
      fill={color}
    />
    <Path
      d="M16 8L2 22"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

const AssetsIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
      fill={color}
    />
  </Svg>
);

const DiscoverIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
    <Path
      d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"
      fill={color}
    />
  </Svg>
);

const ProfileIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" fill="none" />
  </Svg>
);

// 认证导航（登录/注册）
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <AuthStack.Screen name="Login" component={Login} />
      <AuthStack.Screen name="Register" component={Register} />
    </AuthStack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="HomeMain" component={HomePage} />
      <Stack.Screen name="DreamDetail" component={DreamDetail} />
      <Stack.Screen name="CreationCenter" component={CreationCenter} />
      <Stack.Screen name="ScriptViewer" component={ScriptViewer} />
      <Stack.Screen name="ScriptToVideo" component={ScriptToVideo} />
      <Stack.Screen name="ImageViewer" component={ImageViewer} />
      <Stack.Screen name="VideoPlayer" component={VideoPlayer} />
    </Stack.Navigator>
  );
}

function RecordStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="RecordMain" component={RecordModule} />
      <Stack.Screen name="DreamDetail" component={DreamDetail} />
      <Stack.Screen name="CreationCenter" component={CreationCenter} />
      <Stack.Screen name="ScriptViewer" component={ScriptViewer} />
      <Stack.Screen name="ScriptToVideo" component={ScriptToVideo} />
      <Stack.Screen name="ImageViewer" component={ImageViewer} />
      <Stack.Screen name="VideoPlayer" component={VideoPlayer} />
    </Stack.Navigator>
  );
}

function AssetsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="AssetsMain" component={Assets} />
      <Stack.Screen name="ScriptToVideo" component={ScriptToVideo} />
      <Stack.Screen name="ScriptViewer" component={ScriptViewer} />
      <Stack.Screen name="CreationCenter" component={CreationCenter} />
      <Stack.Screen name="ImageViewer" component={ImageViewer} />
      <Stack.Screen name="VideoPlayer" component={VideoPlayer} />
    </Stack.Navigator>
  );
}

function DiscoverStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="DiscoverMain" component={Discover} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ProfileMain" component={Profile} />
      <Stack.Screen name="Subscription" component={Subscription} />
      <Stack.Screen name="PsychologicalTest" component={PsychologicalTest} />
      <Stack.Screen name="ThemeSettings" component={ThemeSettings} />
    </Stack.Navigator>
  );
}

// 主应用导航（底部 Tab）
function MainNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          shadowColor: isDark ? '#000' : 'rgba(0,0,0,0.1)',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 4,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const iconSize = focused ? 26 : 22;
          switch (route.name) {
            case 'Home':
              return <DreamIcon color={color} size={iconSize} />;
            case 'Record':
              return <RecordIcon color={color} size={iconSize} />;
            case 'Assets':
              return <AssetsIcon color={color} size={iconSize} />;
            case 'Discover':
              return <DiscoverIcon color={color} size={iconSize} />;
            case 'Profile':
              return <ProfileIcon color={color} size={iconSize} />;
            default:
              return null;
          }
        },
        tabBarLabel: ({ focused, color }) => {
          let label = '';
          switch (route.name) {
            case 'Home':
              label = '首页';
              break;
            case 'Record':
              label = '记梦';
              break;
            case 'Assets':
              label = '资产';
              break;
            case 'Discover':
              label = '发现';
              break;
            case 'Profile':
              label = '我的';
              break;
          }
          return (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color, fontSize: 11, fontWeight: focused ? '600' : '400' }}>
                {label}
              </Text>
              {focused && (
                <View
                  style={{
                    width: 20,
                    height: 3,
                    backgroundColor: colors.tabBarActive,
                    borderRadius: 1.5,
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Record" component={RecordStack} />
      <Tab.Screen name="Assets" component={AssetsStack} />
      <Tab.Screen name="Discover" component={DiscoverStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// 根导航器
export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();
  const navigationRef = useRef<any>(null);
  const prevAuthRef = useRef<boolean | null>(null);

  // 监听认证状态变化
  useEffect(() => {
    if (prevAuthRef.current !== null && prevAuthRef.current !== isAuthenticated) {
      if (isAuthenticated && navigationRef.current) {
        // 登录成功，重置导航栈到Main
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          })
        );
      }
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="Auth" component={AuthNavigator} />
          </>
        ) : (
          <>
            <Stack.Screen name="Auth" component={AuthNavigator} />
            <Stack.Screen name="Main" component={MainNavigator} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
