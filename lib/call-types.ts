import type { Question } from '@/components/QuestionChecklist';

export type { Question };

export interface SerializableTranscriptEntry {
  id: string;
  speaker: 'you' | 'client';
  text: string;
  isQuestion: boolean;
  aiAnswer?: string;
  matchedQuestionId?: string;
  answeredQuestionId?: string;
}

export interface CallRow {
  id: string;
  created_at: string;
  ended_at: string;
  model: string | null;
  transcript: SerializableTranscriptEntry[];
  questions: Question[];
  summary: string | null;
  utterance_count: number;
  questions_asked_count: number;
}

export interface CallListItem {
  id: string;
  created_at: string;
  ended_at: string;
  model: string | null;
  utterance_count: number;
  questions_asked_count: number;
  has_summary: boolean;
}

/** Strip volatile fields before persisting transcript lines. */
export function serializeTranscript(
  entries: Array<{
    id: string;
    speaker: 'you' | 'client';
    text: string;
    isQuestion: boolean;
    aiAnswer?: string;
    aiLoading?: boolean;
    matchedQuestionId?: string;
    answeredQuestionId?: string;
  }>,
): SerializableTranscriptEntry[] {
  return entries.map((e) => {
    const out: SerializableTranscriptEntry = {
      id: e.id,
      speaker: e.speaker,
      text: e.text,
      isQuestion: e.isQuestion,
    };
    if (e.aiAnswer !== undefined && e.aiAnswer !== '') {
      out.aiAnswer = e.aiAnswer;
    }
    if (e.matchedQuestionId) {
      out.matchedQuestionId = e.matchedQuestionId;
    }
    if (e.answeredQuestionId) {
      out.answeredQuestionId = e.answeredQuestionId;
    }
    return out;
  });
}
