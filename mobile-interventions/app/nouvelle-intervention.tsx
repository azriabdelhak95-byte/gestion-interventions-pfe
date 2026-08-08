import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import SignatureScreen from 'react-native-signature-canvas';
import * as ImageManipulator from 'expo-image-manipulator'; // ✅ Nouvel import ajouté

export default function NouvelleIntervention() {
  const router = useRouter();
  const signatureRef = useRef<any>(null);

  // États des champs de texte
  const [nomClient, setNomClient] = useState('');
  const [adresse, setAdresse] = useState('');
  const [nature, setNature] = useState('');
  const [description, setDescription] = useState('');
  const [statut, setStatut] = useState('Terminé');

  // États pour les médias et le chargement
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  // 👉 GESTION DU BOUTON (Chargement et Succès)
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // --- PRENDRE UNE PHOTO (AVEC RÉDUCTION DE TAILLE) ---
  const prendrePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de la caméra pour prendre des photos.');
      return;
    }

    // 1. On prend la photo normalement
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, 
      quality: 1, // On garde la qualité de base pour la capture
    });

    if (!result.canceled) {
      const originalUri = result.assets[0].uri;

      try {
        // 2. 👉 REDIMENSIONNEMENT MAGIQUE ICI
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          originalUri,
          [{ resize: { width: 800 } }], // On réduit drastiquement les dimensions
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true } // On compresse et on génère le Base64 allégé
        );

        setPhotoUri(manipulatedImage.uri); 
        setPhotoBase64(manipulatedImage.base64 || null); 
      } catch (error) {
        console.error("Erreur lors du redimensionnement :", error);
        Alert.alert("Erreur", "Impossible de traiter la photo.");
      }
    }
  };

  // --- GESTION DE LA SIGNATURE EN TEMPS RÉEL ---
  const effacerSignature = () => {
    signatureRef.current?.clearSignature();
    setSignatureBase64(null);
  };

  // --- ENVOI FINAL AU SERVEUR ---
  const preparerEnvoi = () => {
    console.log("👉 1. Le bouton ENVOYER a été cliqué !");
    
    if (!nomClient.trim() || !adresse.trim() || !nature.trim()) {
      Alert.alert('Champs manquants', 'Veuillez remplir au moins le nom, l\'adresse et la nature (les champs avec un *).');
      return;
    }
    
    envoyerAuServeur(signatureBase64 || "");
  };

  const envoyerAuServeur = async (signatureData: string) => {
    setLoading(true);
    setIsSuccess(false); 
    
    try {
      const userId = await AsyncStorage.getItem('tech_id');
      
      // ✅ Utilisation de la nouvelle adresse IP locale
      const response = await fetch(`http://10.143.150.98:3000/api/interventions`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          technicien_id: userId,
          nom_client: nomClient,
          adresse: adresse,
          nature_intervention: nature,
          description: description,
          statut: statut,
          date_intervention: new Date().toISOString().split('T')[0],
          photo: photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null,
          signature: signatureData 
        })
      });

      const data = await response.json();

      if (data.success) {
        // 👉 LE SERVEUR A DIT OUI : ON AFFICHE LE SUCCÈS
        setIsSuccess(true);
        setLoading(false);
        
        // On attend 1.5 secondes avant de changer de page
        setTimeout(() => {
          router.replace('/explore');
        }, 1500);

      } else {
        setLoading(false);
        Alert.alert('Erreur Serveur', data.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
      Alert.alert('Erreur Réseau', 'Impossible de se connecter au serveur.');
    } 
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Nouvelle Fiche</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView style={styles.scrollView} scrollEnabled={scrollEnabled} contentContainerStyle={styles.scrollContent}>
        
        {/* BLOC 1 : Informations Générales */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="info-circle" size={16} color="white" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Informations Générales</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.label}>Nom du client / Entreprise *</Text>
            <TextInput style={styles.input} placeholder="Ex: CFE Construction..." value={nomClient} onChangeText={setNomClient} />

            <Text style={styles.label}>Adresse du chantier *</Text>
            <TextInput style={styles.input} placeholder="Ex: Avenue Louise 120, Bruxelles" value={adresse} onChangeText={setAdresse} />
          </View>
        </View>

        {/* BLOC 2 : Détails techniques */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="wrench" size={16} color="white" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Détails techniques</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.label}>Nature de l'intervention *</Text>
            <TextInput style={styles.input} placeholder="Ex: Installation fibre..." value={nature} onChangeText={setNature} />

            <Text style={styles.label}>Description des travaux</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Détaillez ce qui a été fait..." value={description} onChangeText={setDescription} multiline />
          </View>
        </View>

        {/* BLOC 3 : Preuve Visuelle */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="camera" size={16} color="white" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Preuve Visuelle</Text>
          </View>
          <View style={styles.sectionBody}>
            {photoUri ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.reprendreBtn} onPress={prendrePhoto}>
                  <Text style={styles.reprendreBtnText}>Reprendre la photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={prendrePhoto}>
                <FontAwesome5 name="camera" size={24} color="#1e3a8a" />
                <Text style={styles.uploadText}>Prendre une photo du chantier</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* BLOC 4 : Validation Client (Signature) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="pen-nib" size={16} color="white" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Validation Client</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.signatureDesc}>Faites signer le client directement sur l'écran.</Text>
            <View style={styles.signatureBox}>
              <SignatureScreen
                ref={signatureRef}
                onBegin={() => setScrollEnabled(false)}
                onEnd={() => {
                  setScrollEnabled(true);
                  signatureRef.current?.readSignature();
                }}
                onOK={(signature) => setSignatureBase64(signature)}
                webStyle={`
                  .m-signature-pad { box-shadow: none; border: none; margin: 0; padding: 0; width: 100%; height: 100%; }
                  .m-signature-pad--body { border: none; }
                  .m-signature-pad--footer { display: none; margin: 0; }
                `}
              />
              <TouchableOpacity style={styles.effacerBtn} onPress={effacerSignature}>
                <FontAwesome5 name="eraser" size={12} color="#475569" />
                <Text style={styles.effacerText}>Effacer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 👉 BOUTON ENVOYER DYNAMIQUE FUSIONNÉ */}
      <TouchableOpacity 
        style={[
          styles.submitBtn, 
          (loading || isSuccess) ? styles.submitBtnEnCours : null // Devient vert si chargement OU succès
        ]} 
        onPress={preparerEnvoi}
        disabled={loading || isSuccess} // Désactivé pendant le chargement et après le succès
        activeOpacity={0.8}
      >
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator color="white" style={{ marginRight: 10 }} />
            <Text style={styles.submitBtnText}>ENVOI EN COURS...</Text>
          </View>
        ) : isSuccess ? (
          <Text style={styles.submitBtnText}>✔ RAPPORT ENVOYÉ !</Text>
        ) : (
          <Text style={styles.submitBtnText}>ENVOYER LE RAPPORT</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { padding: 5 },
  topHeaderTitle: { color: '#1e3a8a', fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 30 },
  
  sectionContainer: { marginBottom: 20, borderRadius: 8, overflow: 'hidden', elevation: 2, backgroundColor: 'white' },
  sectionHeader: { backgroundColor: '#164e63', flexDirection: 'row', alignItems: 'center', padding: 12 },
  sectionIcon: { marginRight: 10 },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sectionBody: { padding: 15, backgroundColor: '#ffffff' },
  
  label: { fontSize: 13, color: '#475569', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 10, fontSize: 14, color: '#334155' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  uploadBox: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderStyle: 'dashed', borderRadius: 8, padding: 30, alignItems: 'center' },
  uploadText: { color: '#0369a1', marginTop: 10, fontWeight: '500' },
  photoContainer: { alignItems: 'center' },
  photoPreview: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
  reprendreBtn: { marginTop: 10, padding: 10, backgroundColor: '#e2e8f0', borderRadius: 4 },
  reprendreBtnText: { color: '#475569', fontWeight: 'bold' },

  signatureDesc: { fontSize: 13, color: '#64748b', marginBottom: 10 },
  signatureBox: { height: 150, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8, position: 'relative', overflow: 'hidden' },
  effacerBtn: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, zIndex: 10 },
  effacerText: { fontSize: 12, marginLeft: 5, color: '#475569' },

  submitBtn: { backgroundColor: '#ea580c', padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  submitBtnEnCours: { backgroundColor: '#059669' },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});