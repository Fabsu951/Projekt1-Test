import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { insertFind, hasSeenSpecies } from '../lib/db';
import { identifySpecies, type IdentificationResult } from '../lib/identify';
import { xpForRarity } from '../lib/species';

type Stage =
  | { name: 'camera' }
  | { name: 'identifying'; photoUri: string }
  | { name: 'result'; photoUri: string; result: IdentificationResult; isNewSpecies: boolean }
  | { name: 'saved'; xpAwarded: number };

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [stage, setStage] = useState<Stage>({ name: 'camera' });

  async function handleCapture() {
    const camera = cameraRef.current;
    if (!camera) return;

    const photo = await camera.takePictureAsync({ quality: 0.6 });
    if (!photo) return;

    setStage({ name: 'identifying', photoUri: photo.uri });

    const result = await identifySpecies(photo.uri);
    const isNewSpecies = !(await hasSeenSpecies(result.species.taxonId));
    setStage({ name: 'result', photoUri: photo.uri, result, isNewSpecies });
  }

  async function handleSave() {
    if (stage.name !== 'result') return;
    const { result, photoUri, isNewSpecies } = stage;

    const baseXp = xpForRarity(result.species.rarity);
    const xpAwarded = isNewSpecies ? baseXp : Math.ceil(baseXp / 4);

    await insertFind({
      taxonId: result.species.taxonId,
      commonName: result.species.commonName,
      scientificName: result.species.scientificName,
      photoUri,
      xpAwarded,
      createdAt: new Date().toISOString(),
    });

    setStage({ name: 'saved', xpAwarded });
  }

  function handleRetake() {
    setStage({ name: 'camera' });
  }

  if (!permission) {
    return <View style={styles.centered} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.message}>Vi behöver kameran för att identifiera djur.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Ge kameratillstånd</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (stage.name === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.captureRow}>
          <Pressable style={styles.captureButton} onPress={handleCapture} />
        </View>
      </View>
    );
  }

  if (stage.name === 'identifying') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>Identifierar...</Text>
      </View>
    );
  }

  if (stage.name === 'result') {
    const { species, confidence } = stage.result;
    return (
      <SafeAreaView style={styles.centered}>
        {stage.isNewSpecies && <Text style={styles.newBadge}>Ny art!</Text>}
        <Text style={styles.speciesName}>{species.commonName}</Text>
        <Text style={styles.scientificName}>{species.scientificName}</Text>
        <Text style={styles.message}>
          {species.family} · {Math.round(confidence * 100)}% säker
        </Text>
        <View style={styles.resultActions}>
          <Pressable style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>Spara fynd</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleRetake}>
            <Text style={styles.secondaryButtonText}>Försök igen</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.centered}>
      <Text style={styles.speciesName}>+{stage.xpAwarded} XP</Text>
      <Text style={styles.message}>Fyndet är sparat i din samling.</Text>
      <Pressable style={styles.button} onPress={handleRetake}>
        <Text style={styles.buttonText}>Hitta nästa djur</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  captureRow: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#ccc',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  message: { fontSize: 16, color: '#444', textAlign: 'center' },
  newBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 4,
  },
  speciesName: { fontSize: 28, fontWeight: '700' },
  scientificName: { fontSize: 16, fontStyle: 'italic', color: '#666' },
  resultActions: { marginTop: 24, gap: 12, width: '100%' },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#2e7d32', fontSize: 16, fontWeight: '600' },
});
