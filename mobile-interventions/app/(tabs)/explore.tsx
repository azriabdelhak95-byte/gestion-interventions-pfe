import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons'; 

export default function MesInterventions() {
  const router = useRouter();
  
  // États de l'application
  const [activeTab, setActiveTab] = useState('afaire'); // 'afaire' ou 'historique'
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(''); // ex: '2026-07'

  // Au chargement de la page, on récupère les missions
  useEffect(() => {
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      // 1. Récupérer l'ID du technicien connecté
      const userId = await AsyncStorage.getItem('tech_id');
      
      if (!userId) {
        router.replace('/'); // Retour à l'accueil si non connecté
        return;
      }

      // 2. Interroger ton API locale via Ngrok AVEC les en-têtes
      const response = await fetch(`https://alesha-unbadgered-dawn.ngrok-free.dev/api/mes-missions/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' // <-- Le pass VIP pour Ngrok
        }
      });
      
      const data = await response.json();

      if (data.success) {
        setMissions(data.missions);
      } else {
        Alert.alert("Erreur", "Impossible de charger vos missions.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur Réseau", "Impossible de joindre le serveur pour vos missions.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear(); // On vide la mémoire
    router.replace('/'); // Retour à la page de connexion
  };

  const ouvrirMission = (idIntervention: number) => {
    // Redirection vers la future page de la fiche technique
    // On lui passe l'ID de la mission en paramètre
    router.push({ pathname: '/fiche-technique', params: { id: idIntervention } });
  };

  // --- NOUVEAU FILTRAGE INTELLIGENT DES DONNÉES ---
  // Cette fonction accepte toutes les variantes du mot "Terminé"
  const estTerminee = (statut: string) => {
    if (!statut) return false;
    const s = statut.toUpperCase();
    return s === 'TERMINÉ' || s === 'TERMINEE' || s === 'TERMINÉE';
  };

  const aFaire = missions.filter(r => !estTerminee(r.statut));
  let terminees = missions.filter(r => estTerminee(r.statut));

  if (filterMonth !== "") {
    terminees = terminees.filter(r => {
      const d = new Date(r.date_intervention);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${year}-${month}` === filterMonth;
    });
  }

  // --- COMPOSANT DE CARTE ---
  const renderCarte = (r: any, isAFaire: boolean) => {
    const date = new Date(r.date_intervention).toLocaleDateString('fr-FR');
    
    let badgeColor = '#059669'; // Success par défaut
    let statutText = r.statut || 'Non spécifié';

    if (!r.statut || r.statut.toLowerCase() === 'à faire' || r.statut === '') { 
      badgeColor = '#3b82f6'; 
      statutText = 'À faire'; 
    }
    else if (r.statut.toLowerCase().includes('attente')) { badgeColor = '#d97706'; }
    else if (r.statut.toLowerCase().includes('replanifier')) { badgeColor = '#dc2626'; }

    return (
      <View key={r.id} style={[styles.card, isAFaire && styles.cardUrgent]}>
        <Text style={styles.cardTitle}>
          <FontAwesome5 name="building" size={16} color="#1e3a8a" /> {r.nom_client || 'Société non renseignée'}
        </Text>
        
        <Text style={styles.infoRow}><FontAwesome5 name="calendar-alt" size={14} color="#f07150" /> <Text style={styles.bold}>Prévu le :</Text> {date}</Text>
        <Text style={styles.infoRow}><FontAwesome5 name="map-marker-alt" size={14} color="#ef4444" /> <Text style={styles.bold}>Adresse :</Text> {r.adresse || 'Adresse à préciser'}</Text>
        <Text style={styles.infoRow}><FontAwesome5 name="tools" size={14} color="#f07150" /> <Text style={styles.bold}>Nature :</Text> {r.nature_intervention || 'Non spécifiée'}</Text>
        
        <View style={styles.noteBox}>
          <Text style={styles.bold}>Note du bureau :</Text>
          <Text style={styles.noteText}>{r.description || 'Aucune note supplémentaire.'}</Text>
        </View>

        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{statutText}</Text>
          </View>
        </View>

        {isAFaire && (
          <TouchableOpacity style={styles.btnOpen} onPress={() => ouvrirMission(r.id)}>
            <Text style={styles.btnOpenText}>COMPLÉTER LA MISSION <FontAwesome5 name="arrow-right" size={14} color="white" /></Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={20} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Interventions</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* TABS */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'afaire' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('afaire')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'afaire' && styles.tabBtnTextActive]}>
            <FontAwesome5 name="hourglass-half" size={14} /> À Faire
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'historique' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('historique')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'historique' && styles.tabBtnTextActive]}>
            <FontAwesome5 name="check-circle" size={14} /> Historique
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENU */}
      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
          
          {/* ONGLET A FAIRE */}
          {activeTab === 'afaire' && (
            <View>
              {aFaire.length === 0 ? (
                <Text style={styles.emptyText}>Super, vous n'avez aucune intervention en attente !</Text>
              ) : (
                aFaire.map(r => renderCarte(r, true))
              )}
            </View>
          )}

          {/* ONGLET HISTORIQUE */}
          {activeTab === 'historique' && (
            <View>
              <View style={styles.filterBox}>
                <Text style={styles.filterLabel}><FontAwesome5 name="calendar-alt" size={14} /> Filtrer par mois (AAAA-MM) :</Text>
                <TextInput 
                  style={styles.filterInput}
                  placeholder="ex: 2026-07"
                  value={filterMonth}
                  onChangeText={setFilterMonth}
                  keyboardType="numeric"
                />
              </View>

              {terminees.length === 0 ? (
                <Text style={styles.emptyText}>Aucune archive pour cette période.</Text>
              ) : (
                terminees.map(r => renderCarte(r, false))
              )}
            </View>
          )}
          
          {/* Espace vide à la fin pour le scroll */}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { 
    backgroundColor: 'white', padding: 20, paddingTop: 50, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, elevation: 3
  },
  headerTitle: { fontWeight: 'bold', color: '#1e3a8a', fontSize: 18 },
  tabsContainer: { 
    flexDirection: 'row', margin: 20, marginBottom: 10, 
    backgroundColor: 'white', padding: 5, borderRadius: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, elevation: 2
  },
  tabBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#1e3a8a' },
  tabBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
  tabBtnTextActive: { color: 'white' },
  contentContainer: { paddingHorizontal: 20 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 30, fontSize: 16 },
  
  // Cartes
  card: { 
    backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 15,
    borderLeftWidth: 4, borderLeftColor: '#1e3a8a',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, elevation: 2
  },
  cardUrgent: { borderLeftColor: '#f07150' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 },
  infoRow: { color: '#475569', fontSize: 14, marginBottom: 6 },
  bold: { fontWeight: 'bold' },
  noteBox: { marginTop: 10, backgroundColor: '#f8fafc', padding: 10, borderRadius: 6 },
  noteText: { color: '#475569', fontSize: 13, marginTop: 4 },
  
  // Badges
  badgeContainer: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, alignItems: 'flex-start' },
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  
  // Bouton
  btnOpen: { 
    backgroundColor: '#1e3a8a', padding: 12, borderRadius: 8, 
    alignItems: 'center', marginTop: 15, flexDirection: 'row', justifyContent: 'center' 
  },
  btnOpenText: { color: 'white', fontWeight: 'bold', fontSize: 14, marginRight: 8 },

  // Filtre
  filterBox: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  filterLabel: { color: '#64748b', fontWeight: 'bold', marginBottom: 8, fontSize: 14 },
  filterInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 16, color: '#334155' }
});