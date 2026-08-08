import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Erreur', 'Veuillez saisir votre adresse email.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('http://10.143.150.98:3000/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                Alert.alert(
                    'Email envoyé !', 
                    'Si cette adresse existe, un lien de réinitialisation vous a été envoyé.',
                    [{ text: 'Retour à la connexion', onPress: () => router.back() }]
                );
            } else {
                Alert.alert('Erreur', data.message || 'Une erreur est survenue.');
            }
        } catch (error) {
            Alert.alert('Erreur réseau', "Impossible de joindre le serveur.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>AZ Engineering</Text>
            <Text style={styles.subtitle}>Réinitialisation du mot de passe</Text>
            
            <View style={styles.form}>
                <Text style={styles.instruction}>
                    Entrez votre adresse email professionnelle. Nous vous enverrons un lien pour créer un nouveau mot de passe.
                </Text>

                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={styles.input}
                    placeholder="technicien@az.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Envoyer le lien</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Retour à la connexion</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', justifyContent: 'center', padding: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'center' },
    subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 40 },
    form: { backgroundColor: '#fff', padding: 20, borderRadius: 10, elevation: 3 },
    instruction: { fontSize: 14, color: '#495057', marginBottom: 20, textAlign: 'center', lineHeight: 20 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#343a40', marginBottom: 5 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 5, padding: 12, marginBottom: 20, fontSize: 16 },
    button: { backgroundColor: '#16a34a', padding: 15, borderRadius: 5, alignItems: 'center', marginBottom: 15 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    backButton: { alignItems: 'center', padding: 10 },
    backButtonText: { color: '#1e3a8a', fontSize: 14, fontWeight: 'bold' }
});