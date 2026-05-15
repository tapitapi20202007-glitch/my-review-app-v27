import { getReviewQuestions, initDB, processUnreviewed } from '@/services/db';
import { requestPermission, scheduleDaily } from '@/services/notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function NotebookBackground() {
  const lines = Array.from({ length: 30 });
  return (
    <View style={styles.notebookBg}>
      <View style={styles.redLine} />
      {lines.map((_, i) => (
        <View key={i} style={[styles.horizontalLine, { top: 60 + i * 32 }]} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [reviewCount, setReviewCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setup();
    }, [])
  );

  async function setup() {
    try {
      initDB();
      processUnreviewed();

      if (Platform.OS !== 'web') {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert('通知の許可', '通知を許可すると復習リマインダーが届きます');
        }
        await scheduleDaily();
      }

      loadReviewCount();
    } catch (e) {
      console.error('初期化エラー:', e);
    }
  }

  function loadReviewCount() {
    const questions = getReviewQuestions();
    setReviewCount(questions.length);
  }

  return (
    <View style={styles.container}>
      <NotebookBackground />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>小テスト復習アプリ</Text>

        <View style={styles.spacer} />

        <View style={styles.buttonsWrapper}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)/upload')}
          >
            <Text style={styles.buttonText}>📷 テスト画像をアップロード</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonGray]}
            onPress={() => router.push('/(tabs)/problems')}
          >
            <Text style={styles.buttonText}>📋 登録済み問題を確認</Text>
          </TouchableOpacity>

          <View style={styles.reviewBox}>
            <Text style={styles.reviewLabel}>今日の復習</Text>
            <Text style={styles.reviewCount}>{reviewCount} 問</Text>
            {reviewCount > 0 ? (
              <TouchableOpacity
                style={[styles.button, styles.buttonGreen]}
                onPress={() => router.push('/review')}
              >
                <Text style={styles.buttonText}>復習テストを始める</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.reviewEmpty}>今日の復習はありません✨</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDE7',
  },
  notebookBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  redLine: {
    position: 'absolute',
    left: 60,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFCDD2',
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#B3E5FC',
  },
  content: {
    padding: 24,
    paddingTop: 100,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#37474F',
    textAlign: 'center',
  },
  spacer: {
    height: 80,
  },
  buttonsWrapper: {
    width: '100%',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonGray: {
    backgroundColor: '#757575',
  },
  buttonGreen: {
    backgroundColor: '#4CAF50',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewBox: {
    marginTop: 16,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  reviewLabel: {
    fontSize: 14,
    color: '#78909C',
    marginBottom: 4,
  },
  reviewCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 4,
  },
  reviewEmpty: {
    fontSize: 14,
    color: '#78909C',
    marginTop: 8,
  },
});