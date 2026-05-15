import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Question } from '@/models/question';
import { insertMultiple } from '@/services/db';
import { analyzeImage } from '@/services/gemini';

interface ExtractedQuestion {
  question_id: string;
  main_question: string;
  sub_question: string;
  answer: string;
  explanation: string;
  checked: boolean;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message);
  }
}

function formatQuestionId(questionId: string): string {
  if (questionId.startsWith('手動-')) return '手動保存';
  return `問${questionId}`;
}

export default function UploadScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [manualMain, setManualMain] = useState('');
  const [manualSub, setManualSub] = useState('');
  const [manualAnswer, setManualAnswer] = useState('');
  const [manualExp, setManualExp] = useState('');

  const [editMain, setEditMain] = useState('');
  const [editSub, setEditSub] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editExp, setEditExp] = useState('');

  const getBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      return await (FileSystem as any).readAsStringAsync(uri, { encoding: 'base64' });
    }
  };

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setQuestions([]);
      setErrorMessage(null);
    }
  }

  async function analyze() {
    if (!imageUri) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const base64 = await getBase64(imageUri);
      const result = await analyzeImage(base64);
      const extracted = (result.questions as any[]).map((q) => ({
        ...q,
        checked: false,
      }));
      setQuestions(extracted);
    } catch (e: any) {
      setErrorMessage(`抽出に失敗しました: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleCheck(index: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, checked: !q.checked } : q))
    );
  }

  function openEdit(index: number) {
    const q = questions[index];
    setEditMain(q.main_question);
    setEditSub(q.sub_question);
    setEditAnswer(q.answer);
    setEditExp(q.explanation);
    setEditingIndex(index);
  }

  function saveEdit() {
    if (editingIndex === null) return;
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === editingIndex
          ? {
              ...q,
              main_question: editMain,
              sub_question: editSub,
              answer: editAnswer,
              explanation: editExp,
            }
          : q
      )
    );
    setEditingIndex(null);
  }

  async function saveQuestions() {
    const selected = questions.filter((q) => q.checked);
    if (selected.length === 0) {
      showAlert('確認', '保存する問題が選択されていません');
      return;
    }
    const now = Date.now();
    const toSave: Question[] = selected.map((q) => ({
      questionId: q.question_id,
      mainQuestion: q.main_question,
      subQuestion: q.sub_question,
      answer: q.answer,
      explanation: q.explanation,
      createdAt: now,
      wrongCount: 1,
    }));
    try {
      insertMultiple(toSave);
      showAlert('保存完了', `${toSave.length} 問を保存しました`);
      setQuestions([]);
      setImageUri(null);
    } catch (e: any) {
      showAlert('エラー', `保存に失敗しました: ${e.message}`);
    }
  }

  function addManual() {
    if (!manualMain && !manualSub) {
      showAlert('エラー', '大問または小問を入力してください');
      return;
    }
    const newQ: ExtractedQuestion = {
      question_id: `手動-${Date.now().toString().slice(-5)}`,
      main_question: manualMain,
      sub_question: manualSub,
      answer: manualAnswer,
      explanation: manualExp,
      checked: true,
    };
    setQuestions((prev) => [...prev, newQ]);
    setManualMain('');
    setManualSub('');
    setManualAnswer('');
    setManualExp('');
    setModalVisible(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
        <Text style={styles.backButtonText}>← ホームに戻る</Text>
      </TouchableOpacity>

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>画像が選択されていません</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>ギャラリーから選択</Text>
      </TouchableOpacity>

      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, styles.buttonBlue, isLoading && styles.buttonDisabled]}
        onPress={analyze}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Geminiで分析</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonOutline]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonOutlineText}>手動で問題を追加</Text>
      </TouchableOpacity>

      {questions.length > 0 && (
        <>
          <View style={styles.successBox}>
            <Text style={styles.successText}>{questions.length} 問を抽出しました</Text>
          </View>

          {questions.map((q, index) => (
            <View
              key={index}
              style={[styles.card, q.checked && styles.cardChecked]}
            >
              <TouchableOpacity
                style={styles.cardTopRow}
                onPress={() => toggleCheck(index)}
              >
                <Text style={styles.checkMark}>{q.checked ? '☑' : '☐'}</Text>
                <Text style={styles.cardTitle}>{formatQuestionId(q.question_id)}</Text>
              </TouchableOpacity>

              <Text style={styles.cardMain}>{q.main_question}</Text>
              <Text style={styles.cardSub}>{q.sub_question}</Text>
              <Text style={styles.cardAnswer}>解答: {q.answer}</Text>
              <Text style={styles.cardExp}>解説: {q.explanation}</Text>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEdit(index)}
              >
                <Text style={styles.editButtonText}>✏️ 編集</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={saveQuestions}>
            <Text style={styles.buttonText}>選択した問題を保存</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>手動で問題を追加</Text>
            <TextInput style={styles.input} placeholder="大問" placeholderTextColor="#999" value={manualMain} onChangeText={setManualMain} />
            <TextInput style={styles.input} placeholder="小問" placeholderTextColor="#999" value={manualSub} onChangeText={setManualSub} />
            <TextInput style={styles.input} placeholder="解答" placeholderTextColor="#999" value={manualAnswer} onChangeText={setManualAnswer} />
            <TextInput style={styles.input} placeholder="解説" placeholderTextColor="#999" value={manualExp} onChangeText={setManualExp} />
            <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={addManual}>
              <Text style={styles.buttonText}>追加する</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={() => setModalVisible(false)}>
              <Text style={styles.buttonOutlineText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editingIndex !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>問題を編集</Text>
            <Text style={styles.inputLabel}>大問</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} placeholder="大問" placeholderTextColor="#999" value={editMain} onChangeText={setEditMain} multiline />
            <Text style={styles.inputLabel}>小問</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} placeholder="小問" placeholderTextColor="#999" value={editSub} onChangeText={setEditSub} multiline />
            <Text style={styles.inputLabel}>解答</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} placeholder="解答" placeholderTextColor="#999" value={editAnswer} onChangeText={setEditAnswer} multiline />
            <Text style={styles.inputLabel}>解説</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} placeholder="解説" placeholderTextColor="#999" value={editExp} onChangeText={setEditExp} multiline />
            <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={saveEdit}>
              <Text style={styles.buttonText}>保存する</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={() => setEditingIndex(null)}>
              <Text style={styles.buttonOutlineText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingTop: 60, flexGrow: 1 },
  backButton: { marginBottom: 20 },
  backButtonText: { color: '#2196F3', fontSize: 16 },
  image: { width: '100%', height: 300, borderRadius: 8, marginBottom: 16 },
  placeholder: {
    width: '100%', height: 200, borderRadius: 8, borderWidth: 1,
    borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  placeholderText: { color: '#999' },
  button: {
    backgroundColor: '#757575', padding: 14, borderRadius: 10,
    alignItems: 'center', marginBottom: 12,
  },
  buttonBlue: { backgroundColor: '#2196F3' },
  buttonGreen: { backgroundColor: '#4CAF50' },
  buttonDisabled: { opacity: 0.5 },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2196F3' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonOutlineText: { color: '#2196F3', fontSize: 16, fontWeight: 'bold' },
  errorBox: { backgroundColor: '#FFEBEE', padding: 12, borderRadius: 8, marginBottom: 12 },
  errorText: { color: '#C62828' },
  successBox: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginBottom: 12 },
  successText: { color: '#2E7D32' },
  card: {
    padding: 12, borderRadius: 10, borderWidth: 1,
    borderColor: '#ddd', marginBottom: 10,
  },
  cardChecked: { borderColor: '#2196F3', backgroundColor: '#E3F2FD' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkMark: { fontSize: 22, marginRight: 10 },
  cardTitle: { fontWeight: 'bold', fontSize: 16 },
  cardMain: { fontSize: 14, color: '#333', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 4 },
  cardAnswer: { fontSize: 13, color: '#2E7D32', marginBottom: 2 },
  cardExp: { fontSize: 13, color: '#666', marginBottom: 8 },
  editButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  editButtonText: { color: '#2196F3', fontSize: 13, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: 24,
  },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  inputLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 10, marginBottom: 12,
    fontSize: 16,
    color: '#333', backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
});

