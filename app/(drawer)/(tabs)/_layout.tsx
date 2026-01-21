import { Tabs } from "expo-router";
import { Compass, Flame, Home, PlusCircle, User } from "lucide-react-native";
import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CircularUploadMenu from '@/components/CircularUploadMenu';

export default function TabLayout() {
  const [menuVisible, setMenuVisible] = useState(false);
  const insets = useSafeAreaInsets();
  
  const tabBarHeight = 55 + Math.max(insets.bottom, 10);
  const tabBarPaddingBottom = Math.max(insets.bottom, 10);

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarStyle: {
          backgroundColor: '#0F1520',
          borderTopColor: '#1E293B',
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
          overflow: 'visible',
        },
        tabBarActiveTintColor: '#4ADE80',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
            marginBottom: 0,
        },
        tabBarIconStyle: {
            marginBottom: 0,
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <Compass color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "",
          tabBarButton: () => {
            return (
              <Pressable
                onPress={() => setMenuVisible(true)}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  top: -15, // Lift the button up
                }}
              >
                <View style={{
                  width: 58,
                  height: 58,
                  backgroundColor: menuVisible ? '#4ADE80' : 'rgba(74, 222, 128, 0.1)',
                  borderRadius: 29,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 6,
                  borderColor: '#0F1520', // Match tab bar bg
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 5,
                  elevation: 5,
                }}>
                  <PlusCircle color={menuVisible ? '#002E15' : '#4ADE80'} size={30} />
                </View>
              </Pressable>
            );
          },
        }}
      />
      <Tabs.Screen
        name="trending"
        options={{
          title: "Trending",
          tabBarIcon: ({ color }) => <Flame color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="clips"
        options={{
          href: null,
        }}
      />


    </Tabs>

    <CircularUploadMenu 
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
      />
    </>
  );
}
