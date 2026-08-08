import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

// --- Données pour le calendrier en français ---
const jours = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];
const joursComplets = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function Explore() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [techNom, setTechNom] = useState('');
  
  // Onglet actif : 'À faire' ou 'Historique'
  const [filtre, setFiltre] = useState('À faire');
  
  // Date sélectionnée pour l'historique (Par défaut : Aujourd'hui)
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datesList, setDatesList] = useState<Date[]>([]);

  // --- NOUVEAUX ÉTATS POUR LE MODE HORS-LIGNE ---
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const router = useRouter();

  // --- Initialisation de la liste des dates (30 jours en arrière, 15 jours en avant) ---
  useEffect(() => {
    const generateDates = () => {
      const dates = [];
      const today = new Date();
      for (let i = -30; i <= 15; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        dates.push(d);
      }
      return dates;
    };
    setDatesList(generateDates());
  }, []);

  const fetchMissions = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('tech_id');
      const nom = await AsyncStorage.getItem('tech_nom');
      
      if (nom) setTechNom(nom);
      if (!userId) return;

      const response = await fetch(`http://192.168.0.137:3000/api/mes-missions/${userId}`);
      const data = await response.json();

      if (data.success) {
        setMissions(data.missions);
      }
    } catch (error) {
      console.error("Erreur réseau :", error);
    } finally {
      setLoading(false);
    }
  };

  // --- FONCTION POUR VÉRIFIER LES RAPPORTS HORS-LIGNE ---
  const checkOfflineData = async () => {
    try {
      const data = await AsyncStorage.getItem('@missions_en_attente');
      if (data) {
        const parsed = JSON.parse(data);
        setPendingSyncCount(parsed.length);
      } else {
        setPendingSyncCount(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMissions();
      checkOfflineData(); // On vérifie à chaque affichage de la page
    }, [])
  );

  // --- FONCTION DE SYNCHRONISATION VERS LE SERVEUR ---
  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const data = await AsyncStorage.getItem('@missions_en_attente');
      if (!data) return;
      
      let missionsEnAttente = JSON.parse(data);
      if (missionsEnAttente.length === 0) return;

      let successCount = 0;
      let failedMissions = [];

      // On boucle sur chaque mission sauvegardée hors-ligne
      for (let mission of missionsEnAttente) {
        try {
          const response = await fetch(`http://192.168.0.137:3000/api/missions/${mission.id_mission}/cloturer`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mission)
          });

          if (response.ok) {
            successCount++; // Si le serveur répond OK
          } else {
            failedMissions.push(mission); // Si erreur serveur
          }
        } catch (err) {
          failedMissions.push(mission); // Si réseau toujours coupé
        }
      }

      // Mise à jour du stockage interne selon les réussites et échecs
      if (failedMissions.length === 0) {
        await AsyncStorage.removeItem('@missions_en_attente');
        setPendingSyncCount(0);
        Alert.alert("Synchronisation réussie", `${successCount} rapport(s) envoyé(s) avec succès.`);
      } else {
        await AsyncStorage.setItem('@missions_en_attente', JSON.stringify(failedMissions));
        setPendingSyncCount(failedMissions.length);
        Alert.alert("Synchronisation partielle", `${successCount} envoyé(s), ${failedMissions.length} toujours en échec. Réessayez plus tard.`);
      }
      
      fetchMissions(); // On rafraîchit la liste de l'écran
    } catch (error) {
      Alert.alert("Erreur", "Un problème est survenu lors de la synchronisation.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Oui", 
          onPress: async () => {
            await AsyncStorage.removeItem('tech_id');
            await AsyncStorage.removeItem('tech_nom');
            router.replace('/'); 
          },
          style: "destructive"
        }
      ]
    );
  };

  // --- Outil de comparaison de dates ---
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  };

  // --- Logique de filtrage PRINCIPALE ---
  const missionsFiltrees = missions.filter(mission => {
    const statut = mission.statut?.toLowerCase() || '';
    const estTermine = statut.includes('termin'); 
    
    if (filtre === 'À faire') {
      return !estTermine; 
    } else {
      if (!estTermine) return false; 
      
      // On filtre l'historique par la date exacte sélectionnée
      if (!mission.date_intervention) return false;
      const missionDate = new Date(mission.date_intervention);
      return isSameDay(missionDate, selectedDate);
    }
  });

  const renderMission = ({ item }: { item: any }) => {
    const estTermine = item.statut?.toLowerCase().includes('termin');
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.7}
        onPress={() => router.push(`/mission/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.clientName}>{item.nom_client || "Client Inconnu"}</Text>
          <View style={[styles.badge, estTermine ? styles.badgeSuccess : styles.badgePending]}>
            <Text style={styles.badgeText}>{item.statut}</Text>
          </View>
        </View>
        
        <Text style={styles.nature}>{item.nature_intervention}</Text>
        
        <View style={styles.addressRow}>
          <FontAwesome5 name="map-marker-alt" size={14} color="#64748b" />
          <Text style={styles.address}>{item.adresse}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* En-tête avec bouton déconnexion */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tableau de bord</Text>
          <Text style={styles.subtitle}>Bonjour, {techNom}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <FontAwesome5 name="sign-out-alt" size={24} color="#bae6fd" />
        </TouchableOpacity>
      </View>

      {/* --- BANDEAU HORS-LIGNE (VISIBLE SEULEMENT SI DONNÉES EN ATTENTE) --- */}
      {pendingSyncCount > 0 && (
        <TouchableOpacity 
          style={styles.syncBanner} 
          onPress={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <FontAwesome5 name="sync-alt" size={16} color="white" />
              <Text style={styles.syncText}>
                Synchroniser {pendingSyncCount} rapport(s) en attente
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Boutons d'onglets pour le filtre */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterBtn, filtre === 'À faire' && styles.filterBtnActive]}
          onPress={() => setFiltre('À faire')}
        >
          <Text style={[styles.filterText, filtre === 'À faire' && styles.filterTextActive]}>À faire</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterBtn, filtre === 'Historique' && styles.filterBtnActive]}
          onPress={() => setFiltre('Historique')}
        >
          <Text style={[styles.filterText, filtre === 'Historique' && styles.filterTextActive]}>Historique</Text>
        </TouchableOpacity>
      </View>

      {/* 📅 LE BANDEAU CALENDRIER S'AFFICHE UNIQUEMENT DANS L'HISTORIQUE 📅 */}
      {filtre === 'Historique' && (
        <View style={styles.calendarContainer}>
          {/* Titre du mois en cours de la date sélectionnée */}
          <Text style={styles.monthTitle}>{mois[selectedDate.getMonth()]}</Text>
          
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={datesList}
            keyExtractor={(item) => item.toISOString()}
            initialScrollIndex={25} // Fait démarrer le défilement près de la date du jour
            getItemLayout={(data, index) => ({ length: 60, offset: 60 * index, index })}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            renderItem={({ item }) => {
              const isActive = isSameDay(item, selectedDate);
              return (
                <TouchableOpacity 
                  onPress={() => setSelectedDate(item)} 
                  style={styles.dateItem}
                >
                  <Text style={[styles.dayName, isActive && styles.dayNameActive]}>
                    {jours[item.getDay()]}
                  </Text>
                  <View style={[styles.dateCircle, isActive && styles.dateCircleActive]}>
                    <Text style={[styles.dateNumber, isActive && styles.dateNumberActive]}>
                      {item.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {/* Le badge bleu "lundi 03 août" */}
          <View style={styles.selectedDateBadgeContainer}>
            <View style={styles.selectedDateBadge}>
              <Text style={styles.selectedDateBadgeText}>
                {`${joursComplets[selectedDate.getDay()]} ${selectedDate.getDate().toString().padStart(2, '0')} ${mois[selectedDate.getMonth()].toLowerCase()}`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Liste des missions */}
      {loading ? (
        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 50 }} />
      ) : missionsFiltrees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="clipboard-check" size={50} color="#cbd5e1" />
          <Text style={styles.emptyText}>
            {filtre === 'À faire' 
              ? "Aucune mission en cours." 
              : "Aucune mission clôturée à cette date."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={missionsFiltrees}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMission}
          contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    padding: 20, 
    paddingTop: 60, 
    backgroundColor: '#1e3a8a', 
    borderBottomLeftRadius: 20, 
    borderBottomRightRadius: 20,
    elevation: 5,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center'
  },
  logoutButton: { padding: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: 'white' },
  subtitle: { fontSize: 16, color: '#bae6fd', marginTop: 5 },
  
  // --- Style du Bandeau de synchronisation ---
  syncBanner: {
    backgroundColor: '#ea580c', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
    elevation: 3,
  },
  syncText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 15,
  },

  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'center',
    gap: 10,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: '#1e3a8a' },
  filterText: { fontSize: 15, fontWeight: 'bold', color: '#64748b' },
  filterTextActive: { color: '#ffffff' },

  // --- Styles du Calendrier ---
  calendarContainer: { 
    backgroundColor: '#f8fafc', 
    paddingTop: 5, 
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  monthTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#334155', 
    marginLeft: 20, 
    marginBottom: 10 
  },
  dateItem: { 
    alignItems: 'center', 
    width: 60, 
    justifyContent: 'center'
  },
  dayName: { 
    fontSize: 12, 
    color: '#94a3b8', 
    marginBottom: 8, 
    fontWeight: '600'
  },
  dayNameActive: { color: '#3b82f6' },
  dateCircle: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  dateCircleActive: { backgroundColor: '#3b82f6' },
  dateNumber: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
  dateNumberActive: { color: 'white' },
  selectedDateBadgeContainer: { 
    marginLeft: 20, 
    marginTop: 15, 
    alignItems: 'flex-start' 
  },
  selectedDateBadge: { 
    backgroundColor: '#3b82f6', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  selectedDateBadgeText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 14, 
    textTransform: 'capitalize' 
  },
  // -----------------------------

  card: { 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 15, 
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clientName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1 },
  
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgePending: { backgroundColor: '#fef08a' }, 
  badgeSuccess: { backgroundColor: '#bbf7d0' }, 
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#334155' },
  
  nature: { fontSize: 15, color: '#0369a1', marginTop: 8, fontWeight: '600' },
  
  addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  address: { fontSize: 14, color: '#64748b', marginLeft: 8, flex: 1 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { textAlign: 'center', marginTop: 15, fontSize: 16, color: '#64748b' }
});