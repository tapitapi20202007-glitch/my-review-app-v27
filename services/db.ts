import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { Question } from '../models/question';

const isWeb = Platform.OS === 'web';
const WEB_STORAGE_KEY = 'study_app_questions';

// --- Web版用のヘルパー関数 ---
const getWebData = (): Question[] => {
  const data = localStorage.getItem(WEB_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveWebData = (questions: Question[]) => {
  localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(questions));
};

// --- SQLiteの設定 (Native用) ---
const dummyDB = {} as unknown as SQLite.SQLiteDatabase;
const db = !isWeb ? SQLite.openDatabaseSync('study_app.db') : dummyDB;

// テーブル作成
export function initDB() {
  if (isWeb) {
    if (!localStorage.getItem(WEB_STORAGE_KEY)) {
      saveWebData([]);
    }
    return;
  }
  db.execSync(`
    CREATE TABLE IF NOT EXISTS questions (
      question_id TEXT PRIMARY KEY,
      main_question TEXT,
      sub_question TEXT,
      answer TEXT,
      explanation TEXT,
      created_at INTEGER,
      wrong_count INTEGER
    );
  `);
}

// 全問題を取得
export function getAllQuestions(): Question[] {
  if (isWeb) return getWebData();
  return db.getAllSync<any>(
    'SELECT * FROM questions ORDER BY created_at DESC'
  ).map(toQuestion);
}

// 復習対象を取得 (7日前の問題を抽出)
export function getReviewQuestions(): Question[] {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() - 7);
  const start = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const end = start + 86399999;

  if (isWeb) {
    return getWebData().filter(q => q.createdAt >= start && q.createdAt <= end);
  }

  return db.getAllSync<any>(
    'SELECT * FROM questions WHERE created_at >= ? AND created_at <= ? ORDER BY question_id ASC',
    [start, end]
  ).map(toQuestion);
}

// 複数問題を一括保存
export function insertMultiple(questions: Question[]) {
  if (isWeb) {
    const current = getWebData();
    // 重複を排除して追加 (INSERT OR REPLACEの代わり)
    const newIds = new Set(questions.map(q => q.questionId));
    const filtered = current.filter(q => !newIds.has(q.questionId));
    saveWebData([...questions, ...filtered]);
    return;
  }

  const stmt = db.prepareSync(
    `INSERT OR REPLACE INTO questions
     (question_id, main_question, sub_question, answer, explanation, created_at, wrong_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    db.execSync('BEGIN TRANSACTION');
    for (const q of questions) {
      stmt.executeSync([
        q.questionId,
        q.mainQuestion,
        q.subQuestion,
        q.answer,
        q.explanation,
        q.createdAt,
        q.wrongCount,
      ]);
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  } finally {
    stmt.finalizeSync();
  }
}

// 1件削除
export function deleteQuestion(id: string) {
  if (isWeb) {
    const filtered = getWebData().filter(q => q.questionId !== id);
    saveWebData(filtered);
    return;
  }
  db.runSync('DELETE FROM questions WHERE question_id = ?', [id]);
}

// 複数削除
export function deleteMultiple(ids: string[]) {
  if (isWeb) {
    const idSet = new Set(ids);
    const filtered = getWebData().filter(q => !idSet.has(q.questionId));
    saveWebData(filtered);
    return;
  }
  const placeholders = ids.map(() => '?').join(', ');
  db.runSync(`DELETE FROM questions WHERE question_id IN (${placeholders})`, ids);
}

export function updateQuestion(q: Question) {
  db.runSync(
    `UPDATE questions SET main_question = ?, sub_question = ?, answer = ?, explanation = ?
     WHERE question_id = ?`,
    [q.mainQuestion, q.subQuestion, q.answer, q.explanation, q.questionId]
  );
}

// 不正解時の更新
export function updateWrongQuestions(ids: string[]) {
  const now = Date.now();
  if (isWeb) {
    const idSet = new Set(ids);
    const current = getWebData().map(q => {
      if (idSet.has(q.questionId)) {
        return { ...q, wrongCount: q.wrongCount + 1, createdAt: now };
      }
      return q;
    });
    saveWebData(current);
    return;
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = db.getAllSync<any>(`SELECT * FROM questions WHERE question_id IN (${placeholders})`, ids);
  const stmt = db.prepareSync('UPDATE questions SET wrong_count = ?, created_at = ? WHERE question_id = ?');
  try {
    db.execSync('BEGIN TRANSACTION');
    for (const row of rows) {
      stmt.executeSync([row.wrong_count + 1, now, row.question_id]);
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  } finally {
    stmt.finalizeSync();
  }
}

// 未実施（期限切れ）の処理
export function processUnreviewed() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threshold = today.getTime() - 7 * 24 * 60 * 60 * 1000;

  if (isWeb) {
    const current = getWebData().map(q => {
      if (q.createdAt < threshold) {
        const dueDate = new Date(q.createdAt + 7 * 24 * 60 * 60 * 1000);
        const newCreatedAt = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
        return { ...q, wrongCount: q.wrongCount + 1, createdAt: newCreatedAt };
      }
      return q;
    });
    saveWebData(current);
    return;
  }

  const rows = db.getAllSync<any>('SELECT * FROM questions WHERE created_at < ?', [threshold]);
  if (rows.length === 0) return;
  const stmt = db.prepareSync('UPDATE questions SET wrong_count = ?, created_at = ? WHERE question_id = ?');
  try {
    db.execSync('BEGIN TRANSACTION');
    for (const row of rows) {
      const dueDate = new Date(row.created_at + 7 * 24 * 60 * 60 * 1000);
      const newCreatedAt = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
      stmt.executeSync([row.wrong_count + 1, newCreatedAt, row.question_id]);
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  } finally {
    stmt.finalizeSync();
  }
}

function toQuestion(row: any): Question {
  return {
    questionId: row.question_id,
    mainQuestion: row.main_question,
    subQuestion: row.sub_question,
    answer: row.answer,
    explanation: row.explanation,
    createdAt: row.created_at,
    wrongCount: row.wrong_count,
  };
}　