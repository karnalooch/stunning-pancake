import { View, Text, ScrollArea, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Activity, ChevronRight, TrendingUp, Share2 } from 'lucide-react-native';

import { ActivityService } from '../services/api';

export const ActivitiesScreen = () => {
  const [activities, setActivities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await ActivityService.getHistory();
        setActivities(data);
      } catch (e) {
        console.error("History fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleShare = async (act: any) => {
    try {
      await Share.share({
        message: `I just finished a ${act.type} session on SPORT! Distance: ${(act.distance / 1000).toFixed(2)} km. Verification Score: ${Math.round(act.verification_score * 100)}%. Join me!`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <TrendingUp size={24} color="#2563EB" />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {activities.map((act) => (
          <TouchableOpacity key={act.id} style={styles.card}>
            <View style={styles.iconBox}>
              <Activity size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{act.type} SESSION</Text>
              <Text style={styles.cardSubtitle}>
                {new Date(act.start_time).toLocaleDateString()} • {(act.distance / 1000).toFixed(2)} km
              </Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{Math.round(act.verification_score * 100)}%</Text>
            </View>
            <TouchableOpacity onPress={() => handleShare(act)}>
               <Share2 size={18} color="#2563EB" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  title: { color: 'white', fontSize: 28, fontWeight: '900' },
  list: { gap: 12 },
  card: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', 
    padding: 16, borderRadius: 16, gap: 16 
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
  cardSubtitle: { color: '#666', fontSize: 12, marginTop: 4 },
  scoreBadge: { backgroundColor: 'rgba(37, 99, 235, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  scoreText: { color: '#2563EB', fontSize: 10, fontWeight: '900' }
});
