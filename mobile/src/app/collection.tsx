import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAllFinds, getFindDates, getTotalXp, type Find } from '../lib/db';
import { computeStreak } from '../lib/streak';

export default function CollectionScreen() {
  const [finds, setFinds] = useState<Find[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        const [allFinds, xp, days] = await Promise.all([getAllFinds(), getTotalXp(), getFindDates()]);
        if (cancelled) return;
        setFinds(allFinds);
        setTotalXp(xp);
        setStreak(computeStreak(days));
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const uniqueSpeciesCount = new Set(finds.map((f) => f.taxonId)).size;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.statsRow}>
        <Stat label="Arter" value={String(uniqueSpeciesCount)} />
        <Stat label="XP" value={String(totalXp)} />
        <Stat label="Streak" value={`${streak}d`} />
      </View>

      {finds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Inga fynd än — gå ut och hitta ditt första djur!</Text>
        </View>
      ) : (
        <FlatList
          data={finds}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.photoUri }} style={styles.thumbnail} />
              <Text style={styles.cardLabel} numberOfLines={1}>
                {item.commonName}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#666' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  grid: { padding: 8 },
  card: { flex: 1 / 3, padding: 6 },
  thumbnail: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#eee' },
  cardLabel: { fontSize: 12, marginTop: 4, textAlign: 'center' },
});
