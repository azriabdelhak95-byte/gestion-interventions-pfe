import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import SignatureScreen from 'react-native-signature-canvas';
import * as ImageManipulator from 'expo-image-manipulator';

// 👉 1. IMPORTATION DE TON FICHIER CONFIG
import { API_URL } from '../config';

export default function NouvelleIntervention() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const signatureRef = useRef<any>(null);

  const [nomClient, setNomClient] = useState(params.nomClientParam ? String(params.nomClientParam) : '');
  const [adresse, setAdresse] = useState(params.adresseParam ? String(params.adresseParam) : '');
  const [nature, setNature] = useState('');
  const [description, setDescription] = useState('');
  const [statut, setStatut] = useState('Terminé');

  const isLinkedToMission = !!params.idMissionParente;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const prendrePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de la caméra pour prendre des photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, 
      quality: 1, 
    });

    if (!result.canceled) {
      const originalUri = result.assets[0].uri;

      try {
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          originalUri,
          [{ resize: { width: 800 } }], 
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true } 
        );

        setPhotoUri(manipulatedImage.uri); 
        setPhotoBase64(manipulatedImage.base64 || null); 
      } catch (error) {
        console.error("Erreur lors du redimensionnement :", error);
        Alert.alert("Erreur", "Impossible de traiter la photo.");
      }
    }
  };

  const effacerSignature = () => {
    signatureRef.current?.clearSignature();
    setSignatureBase64(null);
  };

  const preparerEnvoi = () => {
    if (!nomClient.trim() || !adresse.trim() || !nature.trim()) {
      Alert.alert('Champs manquants', 'Veuillez remplir au moins la nature du travail supplémentaire.');
      return;
    }

    envoyerAuServeur(signatureBase64 || "");
  };

  const envoyerAuServeur = async (signatureData: string) => {
    setLoading(true);
    setIsSuccess(false); 

    try {
      const userId = await AsyncStorage.getItem('tech_id');
      const token = await AsyncStorage.getItem('token'); // 👉 ON RÉCUPÈRE LE BADGE

      if (!token) {
        Alert.alert("Erreur", "Session expirée, veuillez vous reconnecter.");
        router.replace('/');
        return;
      }

      // 👉 2. UTILISATION DE LA VARIABLE API_URL ET DU BADGE ICI !
      const response = await fetch(`${API_URL}/interventions`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // 👉 ON MONTRE LE BADGE AU SERVEUR
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
          signature: signatureData,
          isTravailSupplementaire: isLinkedToMission, 
          mission_parente_id: params.idMissionParente || null 
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        setLoading(false);

        setTimeout(() => {
          router.back();
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
        <Text style={styles.topHeaderTitle}>Extra Hors Devis</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView style={styles.scrollView} scrollEnabled={scrollEnabled} contentContainerStyle={styles.scrollContent}>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="info-circle" size={16} color="white" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Client concerné</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.label}>Nom du client / Entreprise *</Text>
            <TextInput 
              style={[styles.input, isLinkedToMission && styles.inputDisabled]} 
              placeholder="Ex: CFE Construction..." 
              value={nomClient} 
              onChangeText={setNomClient}
              editable={!isLinkedToMission} 
            />

            <Text style={styles.label}>Adresse du chantier *</Text>
            <TextInput 
              style={[styles.input, isLinkedToMission && styles.inputDisabled]} 
              placeholder="Ex: Avenue Louise 120, Bruxelles" 
              value={adresse} 
              onChangeText={setAdresse} 
              editable={!isLinkedToMission}
            />
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="plus-circle" size={16} color="white" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Détails de l'extra</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.label}>Nature du supplément *</Text>
            <TextInput style={styles.input} placeholder="Ex: Tirage de câble supplémentaire..." value={nature} onChangeText={setNature} />

            <Text style={styles.label}>Description des travaux</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Détaillez le travail supplémentaire effectué..." value={description} onChangeText={setDescription} multiline />
          </View>
        </View>

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
                <Text style={styles.uploadText}>Prendre une photo de l'extra</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="pen-nib" size={16} color="white" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Validation Client</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.signatureDesc}>Faites signer le client pour cet extra.</Text>
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

        {/* 👉 LE BOUTON EST MAINTENANT DANS LE SCROLLVIEW */}
        <TouchableOpacity 
          style={[
            styles.submitBtn, 
            (loading || isSuccess) ? styles.submitBtnEnCours : null 
          ]} 
          onPress={preparerEnvoi}
          disabled={loading || isSuccess}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="white" style={{ marginRight: 10 }} />
              <Text style={styles.submitBtnText}>ENREGISTREMENT...</Text>
            </View>
          ) : isSuccess ? (
            <Text style={styles.submitBtnText}>✔ EXTRA VALIDÉ !</Text>
          ) : (
            <Text style={styles.submitBtnText}>VALIDER L'EXTRA</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { padding: 5 },
  topHeaderTitle: { color: '#1e3a8a', fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 40 }, // Ajustement pour que le bouton respire en bas

  sectionContainer: { marginBottom: 20, borderRadius: 8, overflow: 'hidden', elevation: 2, backgroundColor: 'white' },
  sectionHeader: { backgroundColor: '#164e63', flexDirection: 'row', alignItems: 'center', padding: 12 },
  sectionIcon: { marginRight: 10 },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sectionBody: { padding: 15, backgroundColor: '#ffffff' },

  label: { fontSize: 13, color: '#475569', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 10, fontSize: 14, color: '#334155' },

  inputDisabled: { backgroundColor: '#e2e8f0', color: '#94a3b8', borderColor: '#e2e8f0' },

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

  submitBtn: { 
    backgroundColor: '#ea580c', 
    padding: 16, 
    borderRadius: 12, // Bords arrondis
    marginHorizontal: 30, // Il prend moins de place sur les côtés
    marginTop: 10,
    marginBottom: 20, // Évite qu'il ne colle complètement en bas
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center',
    elevation: 3 // Légère ombre 
  },
  submitBtnEnCours: { backgroundColor: '#059669' },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});