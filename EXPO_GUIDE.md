# Expo Go Setup Guide

To get this app on your phone with a QR code, follow these steps on your local computer:

## 1. Initialize Expo Project
Open your terminal and run:
`npx create-expo-app SuperCoinRewards`
`cd SuperCoinRewards`

## 2. Install Dependencies
`npx expo install expo-location expo-map-view firebase react-native-svg lucide-react-native nativewind`

## 3. Core App Code (App.tsx)
Copy this logic into your `App.tsx`. Note that React Native uses different components (View, Text) instead of HTML.

```tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Gift, Zap, Coins } from 'lucide-react-native';

export default function App() {
  return (
    <ScrollView style={styles.container}>
      {/* Loyalty Card */}
      <View style={styles.banner}>
        <View style={styles.header}>
          <Zap size={12} color="#22C55E" />
          <Text style={styles.headerText}>Sector Rewards Active</Text>
        </View>
        
        <Text style={styles.title}>Super Coin Rewards</Text>
        <Text style={styles.subtitle}>Get a FREE VEGETABLE reward every weekend!</Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
             <View style={[styles.progressFill, { width: '20%' }]} />
          </View>
          <Text style={styles.coins}>20 / 100</Text>
        </View>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>EARN MORE COINS</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  banner: { backgroundColor: '#0A0F0B', margin: 20, borderRadius: 32, padding: 30 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerText: { color: '#555', fontSize: 10, uppercase: true, marginLeft: 5 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900', textTransform: 'uppercase' },
  subtitle: { color: '#888', fontSize: 12, marginTop: 10 },
  progressContainer: { marginTop: 20 },
  progressBar: { height: 6, backgroundColor: '#222', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: '#22C55E', borderRadius: 3 },
  coins: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'right', marginTop: 10 },
  button: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginTop: 20, alignItems: 'center' },
  buttonText: { fontWeight: '900', color: '#000' }
});
```

## 4. Run it
`npx expo start`
Then scan the QR code with your phone's camera (iOS) or Expo Go app (Android).
