import { Drawer } from 'expo-router/drawer';
import React from 'react';
import CustomDrawerContent from '@/components/CustomDrawerContent';
import AuthGuard from '@/components/AuthGuard';

export default function DrawerLayout() {
  return (
    <AuthGuard>
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front', // Always front for mobile feel
        drawerStyle: {
             width: '85%', 
             maxWidth: 320,
             backgroundColor: '#131F2A',
        },
        overlayColor: 'rgba(0,0,0,0.8)',
        swipeEdgeWidth: 100,
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="notifications"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="follow-requests"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="blocked-users"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="level-tracker"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="messages"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="store"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="crypto"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="bookmarks"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="help"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="game-categories"
        options={{
          headerShown: false,
        }}
      />
    </Drawer>
    </AuthGuard>
  );
}
