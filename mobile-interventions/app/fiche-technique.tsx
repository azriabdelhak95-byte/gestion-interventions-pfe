import React, { useState, useRef } from 'react'; // <-- Ajout de useRef
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import SignatureScreen from 'react-native-signature-canvas';

export default function FicheTechnique() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 

  const [description, setDescription] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [loading, setLoading] = useState(false);

  const [photoData, setPhotoData] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
  const [modalSignatureVisible, setModalSignatureVisible] = useState(false);

  // --- NOUVEAU : Référence pour contrôler le tableau de signature ---
  const signatureRef = useRef<any>(null);

  const handleValiderSignature = () => {
    signatureRef.current?.readSignature(); // Demande au canvas de générer l'image
  };

  const handleEffacerSignature = () => {
    signatureRef.current?.clearSignature(); // Efface le dessin
  };

  const handleHeureChange = (text: string, setHeure: React.Dispatch<React.SetStateAction<string>>) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) {
      setHeure('');
      return;
    }
    let hours = cleaned.slice(0, 2);
    if (parseInt(hours, 10) > 23) hours = '23';

    let minutes = cleaned.slice(2, 4);
    if (minutes.length > 0) {
      let minInt = parseInt(minutes, 10);
      if (minInt > 59) minutes = '59';
    }

    if (cleaned.length >= 3) {
      setHeure(`${hours}:${minutes}`);
    } else {
      setHeure(hours);
    }
  };

  const prendrePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission requise", "L'accès à la caméra est nécessaire.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setPhotoData(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSignatureOK = (signature: string) => {
    setSignatureData(signature);
    setModalSignatureVisible(false);
  };

  const terminerMission = async () => {
    if (!description.trim()) {
      Alert.alert("Attention", "Le rapport d'intervention est obligatoire.");
      return;
    }

    if ((heureDebut && heureDebut.length < 5) || (heureFin && heureFin.length < 5)) {
      Alert.alert("Format incorrect", "Veuillez entrer des heures valides au format HH:MM.");
      return;
    }

    if (heureDebut && heureFin) {
      const tempsDebut = parseInt(heureDebut.replace(':', ''), 10);
      const tempsFin = parseInt(heureFin.replace(':', ''), 10);

      if (tempsDebut >= tempsFin) {
        Alert.alert("Erreur logique", "L'heure de fin doit être strictement supérieure à l'heure de début.");
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(`https://alesha-unbadgered-dawn.ngrok-free.dev/api/interventions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          statut: 'TERMINEE',
          description: description,
          photo_data: photoData, 
          signature_data: signatureData,
          heure_debut: heureDebut,
          heure_fin: heureFin
        })
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert("Succès", "Mission terminée et rapport sauvegardé !");
        router.replace('/explore'); 
      } else {
        Alert.alert("Erreur serveur", data.error || "Impossible de sauvegarder le rapport.");
      }
    } catch (error) {
      console.error("Erreur PUT intervention:", error);
      Alert.alert("Erreur Réseau", "Impossible de joindre le serveur. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rapport d'Intervention</Text>
        <Text style={styles.headerSubtitle}>Mission #{id}</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Heure de début :</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: 08:30"
          value={heureDebut}
          onChangeText={(text) => handleHeureChange(text, setHeureDebut)}
          keyboardType="numeric"
          maxLength={5}
        />

        <Text style={styles.label}>Heure de fin :</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: 10:45"
          value={heureFin}
          onChangeText={(text) => handleHeureChange(text, setHeureFin)}
          keyboardType="numeric"
          maxLength={5}
        />

        <Text style={styles.label}>Rapport détaillé (Obligatoire) :</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Décrivez les actions effectuées sur le chantier..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <View style={styles.previewsContainer}>
          {photoData && (
            <View style={styles.previewBox}>
              <Text style={styles.successText}>✅ Photo jointe</Text>
              <Image source={{ uri: photoData }} style={styles.imagePreview} />
            </View>
          )}
          {signatureData && (
            <View style={styles.previewBox}>
              <Text style={styles.successText}>✅ Signature</Text>
              <Image source={{ uri: signatureData }} style={styles.imagePreview} />
            </View>
          )}
        </View>

        <View style={styles.mediaContainer}>
          <TouchableOpacity style={styles.mediaBtn} onPress={prendrePhoto}>
            <Text style={styles.mediaBtnText}>📷 Prendre une photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.mediaBtn} onPress={() => setModalSignatureVisible(true)}>
            <Text style={styles.mediaBtnText}>✍️ Faire signer</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={terminerMission} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>CLÔTURER LA MISSION</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={modalSignatureVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.signatureContainer}>
            <Text style={styles.signatureTitle}>Signature du client</Text>
            
            <View style={styles.signatureBoard}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureOK}
                onEmpty={() => Alert.alert("Attention", "La signature est vide.")}
                // NOUVEAU : On cache la barre noire/grise d'origine du webview
                webStyle={`.m-signature-pad--footer { display: none; margin: 0px; }`} 
              />
            </View>

            {/* NOS PROPRES BOUTONS NATIFS */}
            <View style={styles.customButtonsContainer}>
              <TouchableOpacity style={styles.clearBtn} onPress={handleEffacerSignature}>
                <Text style={styles.btnTextWhite}>Effacer</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.confirmBtn} onPress={handleValiderSignature}>
                <Text style={styles.btnTextWhite}>Valider</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalSignatureVisible(false)}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#1e3a8a', padding: 20, paddingTop: 50, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: '#bfdbfe', fontSize: 14, marginTop: 5 },
  formCard: { backgroundColor: 'white', margin: 20, padding: 20, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f8fafc' },
  textArea: { minHeight: 120 },
  
  mediaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  mediaBtn: { flex: 1, backgroundColor: '#e2e8f0', padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  mediaBtnText: { color: '#334155', fontWeight: 'bold', fontSize: 12 },
  
  previewsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 15 },
  previewBox: { alignItems: 'center' },
  successText: { color: '#16a34a', fontWeight: 'bold', marginBottom: 5, fontSize: 12 },
  imagePreview: { width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', resizeMode: 'contain' },
  
  submitBtn: { backgroundColor: '#16a34a', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  signatureContainer: { width: '100%', height: 500, backgroundColor: 'white', borderRadius: 12, padding: 15 },
  signatureTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10, textAlign: 'center' },
  signatureBoard: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, overflow: 'hidden' },
  
  // Nouveaux styles pour les boutons personnalisés
  customButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  clearBtn: { flex: 1, backgroundColor: '#f59e0b', padding: 12, borderRadius: 8, alignItems: 'center', marginRight: 5 },
  confirmBtn: { flex: 1, backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center', marginLeft: 5 },
  btnTextWhite: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  cancelBtn: { backgroundColor: '#ef4444', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  cancelBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});