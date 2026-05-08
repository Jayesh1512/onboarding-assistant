export type CalendarIntegrationStatus = 'not_connected' | 'mock_connected';

export interface ExternalEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: 'google_calendar' | 'calendly';
  meetLink?: string;
  attendees: string[];
}

export interface GlobalQuestion {
  id: string;
  text: string;
  category?: string;
  createdAt: string;
}

export interface MeetingCustomQuestion {
  id: string;
  text: string;
}

export interface KBEntry {
  id: string;
  label: string;
  content: string;
  type: 'text' | 'url' | 'file';
  addedAt: string;
}

export interface Meeting {
  id: string;
  gcalId?: string;
  title: string;
  startsAt: string;
  participants: string[];
  meetLink?: string;
  notes?: string;
  questionIds: string[];
  customQuestions: MeetingCustomQuestion[];
  selectedGlobalKbIds: string[]; // Which global KB entries are included for this meeting
  meetingKbEntries: KBEntry[];   // Meeting-specific KB entries
}

export interface HomeDashboardState {
  meetings: Meeting[];
  calendarStatus: CalendarIntegrationStatus;
}
