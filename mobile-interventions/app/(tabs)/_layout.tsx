import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1e3a8a', // Bleu AZ Engineering pour l'onglet actif
        tabBarInactiveTintColor: '#94a3b8', // Gris pour les onglets inactifs
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 5,
          height: 60,
        },
      }}>
      
      {/* Onglet principal : Les missions du technicien */}
      <Tabs.Screen
        name="explore" 
        options={{
          title: 'Mes Missions',
          tabBarIcon: ({ color }) => <FontAwesome5 name="clipboard-list" size={24} color={color} />,
        }}
      />

      {/* 
        Tu pourras décommenter ce bloc plus tard si tu crées un fichier profil.tsx 
        dans le dossier (tabs)
      */}
      {/* 
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Mon Compte',
          tabBarIcon: ({ color }) => <FontAwesome5 name="user-alt" size={24} color={color} />,
        }}
      /> 
      */}

    </Tabs>
  );
}