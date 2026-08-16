import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// 👉 1. IMPORTATION DU FICHIER CONFIG
import { API_URL } from '../config';

export default function Index() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter(); 

  // ✅ Vérification de session (Auto-Login)
  useEffect(() => {
    const verifierSession = async () => {
      try {
        const userId = await AsyncStorage.getItem('tech_id');
        const token = await AsyncStorage.getItem('token'); // 👉 NOUVEAU : On cherche le badge
        
        // 👉 On s'assure que l'utilisateur ET le badge sont présents
        if (userId && token) {
          router.replace('/(tabs)/explore');
        }
      } catch (error) {
        console.error("Erreur de lecture du stockage :", error);
      }
    };

    verifierSession();
  }, []); 

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }

    try {
      // 👉 2. UTILISATION DE LA VARIABLE API_URL ICI !
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          mot_de_passe: password 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('tech_id', data.user.id.toString());
        await AsyncStorage.setItem('tech_nom', data.user.nom);
        await AsyncStorage.setItem('token', data.token); // 👉 NOUVEAU : On sauvegarde le Badge dans le téléphone
        
        router.replace('/(tabs)/explore'); 
        
      } else {
        Alert.alert("Erreur de connexion", data.message || "Identifiants incorrects");
      }
    } catch (error) {
      Alert.alert("Erreur Réseau", "Impossible de joindre le serveur. Vérifiez la connexion.");
      console.error("Détail de l'erreur :", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* --- LE LOGO EST MAINTENANT APPELÉ "logo.png" --- */}
      <Image 
        source={require('../assets/logo.png')} 
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>AZ Engineering</Text>
      <Text style={styles.subtitle}>Espace Technicien</Text>

      <TextInput
        style={styles.input}
        placeholder="Adresse Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true} 
      />

      <TouchableOpacity 
        style={styles.forgotPasswordContainer} 
        onPress={() => router.push('/mot-de-passe-oublie')}
      >
        <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>SE CONNECTER</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20, 
    backgroundColor: '#f4f6f8' 
  },
  logo: {
    width: 150,
    height: 120,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#1e3a8a', 
    textAlign: 'center', 
    margin: 0,
    marginBottom: 5 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#64748b', 
    textAlign: 'center', 
    marginBottom: 40 
  },
  input: { 
    backgroundColor: '#ffffff', 
    padding: 15, 
    borderRadius: 8, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#cbd5e1',
    fontSize: 16
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
    marginTop: -5,
  },
  forgotPasswordText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '600',
  },
  button: { 
    backgroundColor: '#16a34a', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 10
  },
  buttonText: { 
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  }
});