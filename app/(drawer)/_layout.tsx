import { Drawer } from 'expo-router/drawer';
import React from 'react';
import CustomDrawerContent from '@/components/CustomDrawerContent';

export default function DrawerLayout() {
  return (
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
        name="wallet"
        options={{
          headerShown: false,
        }}
      />
    </Drawer>
  );
}
