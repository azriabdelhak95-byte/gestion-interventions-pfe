import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

export default function Index() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter(); 

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }

    try {
      // ✅ Utilisation du lien Ngrok avec l'en-tête qui désactive l'avertissement
      const response = await fetch('https://alesha-unbadgered-dawn.ngrok-free.dev/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' // <-- Le pass VIP pour Ngrok
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
        
        // Redirection vers l'écran des interventions
        router.replace('/explore'); 
        
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