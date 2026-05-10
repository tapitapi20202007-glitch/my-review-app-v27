import { Question } from '@/models/question';
import { deleteQuestion, getAllQuestions, updateQuestion } from '@/services/db';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日にアップロード`;
}

function formatQuestionId(questionId: string): string {
  if (questionId.startsWith('手動-')) return '手動保存';
  return `問${questionId}`;
}

export default function ProblemsScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const [editMain, setEditMain] = useState('');
  const [editSub, setEditSub] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editExp, setEditExp] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadQuestions();
    }, [])
  );

  function loadQuestions() {
    const data = getAllQuestions();
    setQuestions(data);
  }

  function handleDelete(id: string) {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('この問題を削除しますか？');
      if (confirmed) {
        deleteQuestion(id);
        setQuestions((prev) => prev.filter((q) => q.questionId !== id));
      }
    } else {
      const { Alert } = require('react-native');
      Alert.alert('削除確認', 'この問題を削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            deleteQuestion(id);
            setQuestions((prev) => prev.filter((q) => q.questionId !== id));
          },
        },
      ]);
    }
  }

  function openEdit(q: Question) {
    setEditMain(q.mainQuestion);
    setEditSub(q.subQuestion);
    setEditAnswer(q.answer);
    setEditExp(q.explanation);
    setEditingQuestion(q);
  }

  function saveEdit() {
    if (!editingQuestion) return;
    const updated: Question = {
      ...editingQuestion,
      mainQuestion: editMain,
      subQuestion: editSub,
      answer: editAnswer,
      explanation: editExp,
    };
    updateQuestion(updated);
    setQuestions((prev) =>
      prev.map((q) => (q.questionId === updated.questionId ? updated : q))
    );
    setEditingQuestion(null);
  }

  if (questions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>登録済みの問題がありません</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={questions}
        keyExtractor={(item) => item.questionId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.questionId;
          return (
            <View style={styles.card}>
              {/* ヘッダー行 */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardId}>{formatQuestionId(item.questionId)}</Text>
                <View style={styles.headerRight}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.wrongCount}回目</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.questionId)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>削除</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* アップロード日 */}
              <Text style={styles.uploadDate}>{formatDate(item.createdAt)}</Text>

              {/* 問題文（常に表示） */}
              <Text style={styles.mainQuestion}>{item.mainQuestion}</Text>
              <Text style={styles.subQuestion}>{item.subQuestion}</Text>

              {/* 詳細ボタン */}
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() =>
                  setExpandedId(isExpanded ? null : item.questionId)
                }
              >
                <Text style={styles.detailButtonText}>
                  {isExpanded ? '▲ 閉じる' : '▼ 詳細を見る'}
                </Text>
              </TouchableOpacity>

              {/* 詳細エリア */}
              {isExpanded && (
                <View style={styles.detailArea}>
                  <Text style={styles.answer}>解答: {item.answer}</Text>
                  <Text style={styles.explanation}>解説: {item.explanation}</Text>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEdit(item)}
                  >
                    <Text style={styles.editButtonText}>✏️ 編集</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* 編集モーダル */}
      <Modal visible={editingQuestion !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>問題を編集</Text>
            <Text style={styles.inputLabel}>大問</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="大問"
              placeholderTextColor="#999"
              value={editMain}
              onChangeText={setEditMain}
              multiline
            />
            <Text style={styles.inputLabel}>小問</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="小問"
              placeholderTextColor="#999"
              value={editSub}
              onChangeText={setEditSub}
              multiline
            />
            <Text style={styles.inputLabel}>解答</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="解答"
              placeholderTextColor="#999"
              value={editAnswer}
              onChangeText={setEditAnswer}
              multiline
            />
            <Text style={styles.inputLabel}>解説</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="解説"
              placeholderTextColor="#999"
              value={editExp}
              onChangeText={setEditExp}
              multiline
            />
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonBlue]}
              onPress={saveEdit}
            >
              <Text style={styles.modalButtonText}>保存する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonOutline]}
              onPress={() => setEditingQuestion(null)}
            >
              <Text style={styles.modalButtonOutlineText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardId: { fontSize: 16, fontWeight: 'bold' },
  badge: {
    backgroundColor: '#FFE0B2', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 99,
  },
  badgeText: { color: '#E65100', fontSize: 12, fontWeight: 'bold' },
  deleteButton: {
    backgroundColor: '#FFEBEE', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 99,
  },
  deleteText: { color: '#C62828', fontSize: 12, fontWeight: 'bold' },
  uploadDate: { fontSize: 12, color: '#888', marginBottom: 6 },
  mainQuestion: { fontSize: 14, color: '#333', marginBottom: 6 },
  subQuestion: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 8 },
  detailButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 4,
  },
  detailButtonText: { color: '#555', fontSize: 13 },
  detailArea: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  answer: { fontSize: 13, color: '#2E7D32', fontWeight: 'bold', marginBottom: 4 },
  explanation: { fontSize: 13, color: '#555', marginBottom: 10 },
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
    padding: 10, marginBottom: 12, fontSize: 16,
    color: '#333', backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  modalButton: {
    padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12,
  },
  buttonBlue: { backgroundColor: '#2196F3' },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2196F3' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalButtonOutlineText: { color: '#2196F3', fontSize: 16, fontWeight: 'bold' },
});