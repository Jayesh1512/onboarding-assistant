import type { HomeDashboardState } from '@/lib/home-types';

export const HOME_DASHBOARD_STORAGE_KEY = 'home-dashboard-state-v2';

export const HOME_DASHBOARD_DEFAULT_STATE: HomeDashboardState = {
  meetings: [
    {
      id: 'meeting-1',
      title: 'Discovery Call · Acme Corp',
      startsAt: '2026-05-20T10:00',
      participants: ['Jayesh', 'Anita', 'Rahul'],
      meetLink: 'https://meet.google.com/aaa-bbbb-ccc',
      notes: 'Focus on onboarding timeline and integrations.',
      questionIds: [],
      customQuestions: [{ id: 'cq-1', text: 'Who signs off final requirements?' }],
      selectedGlobalKbIds: [],
      meetingKbEntries: [],
    },
    {
      id: 'meeting-2',
      title: 'Weekly Success Review',
      startsAt: '2026-05-22T16:30',
      participants: ['Jayesh', 'Customer Ops Lead'],
      meetLink: 'https://meet.google.com/ddd-eeee-fff',
      notes: 'Review adoption metrics and blockers.',
      questionIds: [],
      customQuestions: [],
      selectedGlobalKbIds: [],
      meetingKbEntries: [],
    },
  ],
  calendarStatus: 'not_connected',
};
