import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Linking, Platform, TextInput, Image, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import SignatureScreen from 'react-native-signature-canvas';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system'; // NOUVEAU
import * as Sharing from 'expo-sharing'; // NOUVEAU

export default function MissionDetail() {
  const { id } = useLocalSearchParams();
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [rapport, setRapport] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  
  const [materielsDisponibles, setMaterielsDisponibles] = useState<any[]>([]);
  const [materielsUtilises, setMaterielsUtilises] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMaterielId, setSelectedMaterielId] = useState<string | null>(null);
  const [quantiteTemp, setQuantiteTemp] = useState('1');

  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  const signatureRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resMission = await fetch(`http://192.168.0.137:3000/api/missions/${id}`);
        if (!resMission.ok) throw new Error("Erreur serveur mission");
        const dataMission = await resMission.json();
        if (dataMission.success) {
          setMission(dataMission.mission);
        }

        const resMateriel = await fetch(`http://192.168.0.137:3000/api/materiels`);
        if (resMateriel.ok) {
          const dataMateriel = await resMateriel.json();
          setMaterielsDisponibles(dataMateriel);
        }
      } catch (error) {
        Alert.alert("Erreur", "Impossible de charger les données.");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const prendrePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission refusée", "L'application a besoin d'accéder à l'appareil photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.5,
      base64: true, 
    });
    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const validerAjoutMateriel = () => {
    if (!selectedMaterielId) return Alert.alert("Attention", "Veuillez sélectionner un matériel.");
    const qty = parseInt(quantiteTemp, 10);
    if (isNaN(qty) || qty <= 0) return Alert.alert("Erreur", "Quantité invalide.");

    const mat = materielsDisponibles.find(m => m.id_materiel === selectedMaterielId);
    if (qty > mat.quantite_stock) return Alert.alert("Stock insuffisant", `Il ne reste que ${mat.quantite_stock} ${mat.nom_materiel}.`);

    setMaterielsUtilises([...materielsUtilises, { id_materiel: mat.id_materiel, nom_materiel: mat.nom_materiel, quantite: qty }]);
    setModalVisible(false); setSelectedMaterielId(null); setQuantiteTemp('1');
  };

  const supprimerMateriel = (index: number) => {
    const nouvelleListe = [...materielsUtilises];
    nouvelleListe.splice(index, 1);
    setMaterielsUtilises(nouvelleListe);
  };

  // --- NOUVELLE LOGIQUE HORS-LIGNE ---
  const handleCloturer = async () => {
    if (!rapport.trim()) return Alert.alert("Attention", "Veuillez écrire un bref rapport.");

    Alert.alert("Clôturer", "Confirmez-vous la fin de cette intervention ?", [
      { text: "Annuler", style: "cancel" },
      { 
        text: "Oui, clôturer", 
        onPress: async () => {
          setIsUpdating(true);
          
          // On prépare les données à envoyer ou à sauvegarder
          const dataToSave = {
            id_mission: id,
            statut: 'Terminé', 
            rapport_texte: rapport, 
            photo_data: photo, 
            signature_client: signature, 
            materiels: materielsUtilises 
          };

          try {
            // 1. On vérifie si on a du réseau
            const netState = await NetInfo.fetch();
            
            if (netState.isConnected) {
              // --- EN LIGNE (On envoie au serveur) ---
              const response = await fetch(`http://192.168.0.137:3000/api/missions/${id}/cloturer`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
              });

              if (response.ok) {
                Alert.alert("Succès", "L'intervention a bien été clôturée en ligne !");
                router.back();
              } else {
                Alert.alert("Erreur", "Impossible de mettre à jour la base de données.");
              }
            } else {
              // --- HORS LIGNE (On sauvegarde dans le téléphone) ---
              // Récupérer les données déjà en attente
              const existingData = await AsyncStorage.getItem('@missions_en_attente');
              let missionsEnAttente = existingData ? JSON.parse(existingData) : [];
              
              // Ajouter la nouvelle mission
              missionsEnAttente.push(dataToSave);
              
              // Sauvegarder dans le téléphone
              await AsyncStorage.setItem('@missions_en_attente', JSON.stringify(missionsEnAttente));
              
              Alert.alert(
                "Mode Hors-Ligne", 
                "Réseau indisponible. Le rapport a été sauvegardé dans votre téléphone et sera envoyé automatiquement dès que vous retrouverez la connexion."
              );
              router.back();
            }

          } catch (error) {
            Alert.alert("Erreur", "Problème lors de la clôture.");
          } finally {
            setIsUpdating(false);
          }
        }
      }
    ]);
  };

  const openGPS = () => {
    if (!mission.adresse) return Alert.alert("Erreur", "Aucune adresse n'est renseignée.");
    const url = Platform.select({ ios: `maps:0,0?q=${encodeURIComponent(mission.adresse)}`, android: `geo:0,0?q=${encodeURIComponent(mission.adresse)}` });
    if (url) Linking.openURL(url).catch(() => Alert.alert("Erreur", "Impossible d'ouvrir le GPS."));
  };

  // --- NOUVELLE FONCTION POUR OUVRIR LE DOCUMENT BASE64 ---
  const ouvrirDocument = async () => {
    try {
      const base64Data = mission.url_cahier_charges;
      if (!base64Data) return;
      
      // Si ce n'est pas du Base64 (ex: un vrai lien http), on l'ouvre normalement
      if (!base64Data.includes('base64,')) {
        Linking.openURL(base64Data).catch(() => 
          Alert.alert("Erreur", "Impossible d'ouvrir le lien.")
        );
        return;
      }

      // On sépare l'en-tête des données pures
      const parts = base64Data.split(';base64,');
      // On devine l'extension (PDF, PNG ou JPG par défaut)
      const ext = parts[0].includes('pdf') ? 'pdf' : parts[0].includes('png') ? 'png' : 'jpg';
      const base64String = parts[1];
      
      // On crée un fichier temporaire dans le cache du téléphone
      const fileUri = FileSystem.cacheDirectory + `Cahier_des_charges.${ext}`;
      
      // On écrit le fichier
      await FileSystem.writeAsStringAsync(fileUri, base64String, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // On ouvre la fenêtre de partage/lecture du téléphone
      await Sharing.shareAsync(fileUri);

    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de lire et d'ouvrir ce fichier.");
    }
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#16a34a" /></View>;
  if (!mission) return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>Aucune donnée trouvée.</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.backButtonText}>Retour</Text></TouchableOpacity>
    </View>
  );

  const estTermine = mission.statut?.toLowerCase().includes('termin');

  const styleCSSSignature = `.m-signature-pad { box-shadow: none; border: none; margin: 0px; } .m-signature-pad--body { border: none; } .m-signature-pad--footer { display: none; }`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }} scrollEnabled={scrollEnabled}>
      <View style={styles.headerCard}>
        <Text style={styles.clientName}>{mission.nom_client || "Client Inconnu"}</Text>
        <View style={[styles.badge, estTermine ? styles.badgeSuccess : styles.badgePending]}>
          <Text style={styles.badgeText}>{mission.statut}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations de l'intervention</Text>
        <View style={styles.row}>
          <FontAwesome5 name="tools" size={16} color="#1e3a8a" style={styles.icon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nature</Text>
            <Text style={styles.value}>{mission.nature_intervention}</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.row} onPress={openGPS} activeOpacity={0.7}>
          <FontAwesome5 name="map-marker-alt" size={16} color="#e11d48" style={styles.icon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Adresse (Cliquez pour y aller)</Text>
            <Text style={[styles.value, { color: '#0369a1', textDecorationLine: 'underline' }]}>{mission.adresse}</Text>
          </View>
          <FontAwesome5 name="external-link-alt" size={14} color="#0369a1" style={{ alignSelf: 'center', marginLeft: 10 }} />
        </TouchableOpacity>

        {/* --- BOUTON CAHIER DES CHARGES MIS À JOUR --- */}
        {mission.url_cahier_charges && (
          <TouchableOpacity 
            style={[styles.row, { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#bae6fd' }]} 
            onPress={ouvrirDocument}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="file-pdf" size={20} color="#0284c7" style={styles.icon} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: '#0284c7' }]}>Document annexé</Text>
              <Text style={[styles.value, { color: '#0369a1', fontSize: 14, fontWeight: 'bold' }]}>Voir le cahier des charges</Text>
            </View>
            <FontAwesome5 name="download" size={14} color="#0284c7" style={{ alignSelf: 'center', marginLeft: 10 }} />
          </TouchableOpacity>
        )}

      </View>

      {/* SECTION DYNAMIQUE : LECTURE SEULE OU ÉDITION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {estTermine ? "Rapport de clôture" : "Rapport de fin d'intervention"}
        </Text>

        {estTermine ? (
          /* ==========================================
             --- MODE LECTURE SEULE (HISTORIQUE) ---
             ========================================== */
          <View>
            <Text style={styles.label}>Description du travail :</Text>
            <Text style={[styles.value, styles.readOnlyBox]}>{mission.description || "Aucun rapport saisi."}</Text>

            {mission.photo_data && (
              <View style={{ marginTop: 15 }}>
                <Text style={styles.label}>Photo du chantier :</Text>
                <Image source={{ uri: mission.photo_data }} style={styles.previewImage} />
              </View>
            )}

            {mission.signature_data && (
              <View style={{ marginTop: 15 }}>
                <Text style={styles.label}>Signature du client :</Text>
                <Image source={{ uri: mission.signature_data }} style={styles.signaturePreview} />
              </View>
            )}
          </View>
        ) : (
          /* ==========================================
             --- MODE ÉDITION (NOUVELLE MISSION) ---
             ========================================== */
          <View>
            <TextInput
              style={styles.input} placeholder="Décrivez le travail effectué..." multiline numberOfLines={4} value={rapport} onChangeText={setRapport}
            />

            <TouchableOpacity style={styles.photoButton} onPress={prendrePhoto}>
              <FontAwesome5 name="camera" size={16} color="#1e3a8a" style={{ marginRight: 10 }} />
              <Text style={styles.photoButtonText}>{photo ? "Photo prise (Cliquer pour refaire)" : "Prendre une photo du chantier"}</Text>
            </TouchableOpacity>

            {photo && <Image source={{ uri: photo }} style={styles.previewImage} />}

            <View style={styles.materielContainer}>
              <Text style={styles.sectionTitle}>Matériel consommé</Text>
              {materielsUtilises.length === 0 ? (
                <Text style={styles.emptyText}>Aucun matériel renseigné.</Text>
              ) : (
                materielsUtilises.map((mat, index) => (
                  <View key={index} style={styles.materielRow}>
                    <Text style={styles.materielName}>• {mat.nom_materiel}</Text>
                    <Text style={styles.materielQty}>Qté: {mat.quantite}</Text>
                    <TouchableOpacity onPress={() => supprimerMateriel(index)} style={{ padding: 5 }}><FontAwesome5 name="trash" size={14} color="#e11d48" /></TouchableOpacity>
                  </View>
                ))
              )}
              <TouchableOpacity style={styles.addMaterielButton} onPress={() => setModalVisible(true)}>
                <FontAwesome5 name="plus" size={14} color="#0369a1" style={{ marginRight: 8 }} />
                <Text style={styles.addMaterielText}>Ajouter du matériel</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 15 }]}>Signature du client</Text>
            {!signature ? (
              <View>
                <View style={styles.signatureContainer}>
                  <SignatureScreen
                    ref={signatureRef} onOK={(sig) => { setSignature(sig); setScrollEnabled(true); }} webStyle={styleCSSSignature} onBegin={() => setScrollEnabled(false)} onEnd={() => setScrollEnabled(true)}
                  />
                </View>
                <View style={styles.signatureButtonsRow}>
                  <TouchableOpacity style={styles.signatureButtonClear} onPress={() => signatureRef.current?.clearSignature()}><Text style={styles.signatureButtonClearText}>Effacer</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.signatureButtonConfirm} onPress={() => signatureRef.current?.readSignature()}><Text style={styles.signatureButtonConfirmText}>Valider la signature</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <Image source={{ uri: signature }} style={styles.signaturePreview} />
                <TouchableOpacity style={styles.clearSignatureButton} onPress={() => setSignature(null)}>
                  <FontAwesome5 name="undo" size={14} color="#e11d48" style={{ marginRight: 8 }} />
                  <Text style={styles.clearSignatureText}>Recommencer la signature</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {!estTermine && (
        <TouchableOpacity style={styles.cloturerButton} onPress={handleCloturer} disabled={isUpdating}>
          {isUpdating ? <ActivityIndicator color="white" /> : (
            <><FontAwesome5 name="check-circle" size={20} color="white" style={{ marginRight: 10 }} /><Text style={styles.buttonText}>CLÔTURER L'INTERVENTION</Text></>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.backDashboardButton} onPress={() => router.back()}>
        <Text style={styles.backDashboardText}>Retour au tableau de bord</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choisir un équipement</Text>
            <ScrollView style={styles.matList}>
              {materielsDisponibles.map(mat => (
                <TouchableOpacity key={mat.id_materiel} style={[styles.matOption, selectedMaterielId === mat.id_materiel && styles.matOptionSelected]} onPress={() => setSelectedMaterielId(mat.id_materiel)}>
                  <Text style={[styles.matOptionText, selectedMaterielId === mat.id_materiel && { color: '#0369a1', fontWeight: 'bold' }]}>{mat.nom_materiel}</Text>
                  <Text style={styles.matOptionStock}>Stock: {mat.quantite_stock}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedMaterielId && (
              <View style={styles.qtyContainer}>
                <Text style={styles.qtyLabel}>Quantité :</Text>
                <TextInput style={styles.qtyInput} keyboardType="numeric" value={quantiteTemp} onChangeText={setQuantiteTemp} />
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => { setModalVisible(false); setSelectedMaterielId(null); }} style={styles.modalBtnCancel}><Text style={styles.modalBtnCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity onPress={validerAjoutMateriel} style={styles.modalBtnAdd}><Text style={styles.modalBtnAddText}>Valider</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerCard: { backgroundColor: 'white', padding: 20, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  clientName: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', flex: 1 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgePending: { backgroundColor: '#fef08a' },
  badgeSuccess: { backgroundColor: '#bbf7d0' },
  badgeText: { fontSize: 13, fontWeight: 'bold', color: '#334155' },
  section: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 15 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  icon: { marginRight: 15, marginTop: 2 },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  value: { fontSize: 16, color: '#1e293b', marginTop: 2 },
  
  readOnlyBox: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 15, textAlignVertical: 'top', minHeight: 80, marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1' },
  photoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0f2fe', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 15 },
  photoButtonText: { color: '#1e3a8a', fontWeight: 'bold', fontSize: 14 },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 10, resizeMode: 'cover' },

  materielContainer: { marginTop: 10, marginBottom: 20, padding: 15, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  emptyText: { color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 },
  materielRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  materielName: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
  materielQty: { fontSize: 14, fontWeight: 'bold', color: '#0369a1', marginRight: 15 },
  addMaterielButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#0369a1', borderRadius: 6, marginTop: 5 },
  addMaterielText: { color: '#0369a1', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, maxHeight: '80%', elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'center' },
  matList: { maxHeight: 300, marginBottom: 15 },
  matOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  matOptionSelected: { backgroundColor: '#f0f9ff', borderRadius: 6, borderBottomWidth: 0 },
  matOptionText: { fontSize: 15, color: '#334155' },
  matOptionStock: { fontSize: 13, color: '#64748b' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8 },
  qtyLabel: { fontSize: 15, fontWeight: 'bold', marginRight: 10, color: '#334155' },
  qtyInput: { backgroundColor: 'white', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, width: 60, textAlign: 'center', fontSize: 16, padding: 5 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtnCancel: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', marginRight: 10 },
  modalBtnCancelText: { color: '#475569', fontWeight: 'bold' },
  modalBtnAdd: { flex: 1, padding: 12, backgroundColor: '#0369a1', borderRadius: 8, alignItems: 'center' },
  modalBtnAddText: { color: 'white', fontWeight: 'bold' },

  signatureContainer: { height: 250, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, overflow: 'hidden', marginBottom: 15, backgroundColor: '#ffffff' },
  signatureButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  signatureButtonClear: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  signatureButtonClearText: { color: '#475569', fontWeight: 'bold', fontSize: 14 },
  signatureButtonConfirm: { flex: 1, backgroundColor: '#0284c7', padding: 12, borderRadius: 8, alignItems: 'center' },
  signatureButtonConfirmText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  signaturePreview: { width: '100%', height: 150, resizeMode: 'contain', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 10 },
  clearSignatureButton: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#ffe4e6', borderRadius: 8 },
  clearSignatureText: { color: '#e11d48', fontWeight: 'bold' },

  cloturerButton: { backgroundColor: '#16a34a', padding: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 3 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  backDashboardButton: { backgroundColor: '#e2e8f0', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 30 },
  backDashboardText: { color: '#475569', fontSize: 16, fontWeight: 'bold' },
  errorText: { fontSize: 16, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  backButton: { backgroundColor: '#1e3a8a', padding: 12, borderRadius: 8 },
  backButtonText: { color: 'white', fontWeight: 'bold' }
});