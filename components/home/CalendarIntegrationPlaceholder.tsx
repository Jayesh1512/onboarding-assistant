'use client';

import type { CalendarIntegrationStatus } from '@/lib/home-types';
import {
  HOME_BUTTON_3D_PRIMARY,
  HOME_BUTTON_3D_SECONDARY,
} from '@/lib/home-button-styles';

interface Props {
  status: CalendarIntegrationStatus;
  onToggleStatus: () => void;
}

export default function CalendarIntegrationPlaceholder({ status, onToggleStatus }: Props) {
  const connected = status === 'mock_connected';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Calendar integration placeholder</h3>
      <p className="mt-1 text-xs text-slate-500">UI-only placeholder. No real Google Calendar sync yet.</p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-700">
          Status:{' '}
          <span className={`font-semibold ${connected ? 'text-emerald-700' : 'text-slate-600'}`}>
            {connected ? 'Mock connected' : 'Not connected'}
          </span>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleStatus}
            className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-2 text-sm`}
          >
            {connected ? 'Set as not connected' : 'Mock connect Google Calendar'}
          </button>
          <button
            type="button"
            className={`${HOME_BUTTON_3D_SECONDARY} px-4 py-2 text-sm`}
          >
            Manage sync settings
          </button>
        </div>
      </div>
    </section>
  );
}
