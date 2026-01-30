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
             backgroundColor: '#0F1520',
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
    </Drawer>
    </AuthGuard>
  );
}
