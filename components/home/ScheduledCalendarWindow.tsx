'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import type { Meeting, ExternalEvent } from '@/lib/home-types';
import {
  HOME_BUTTON_3D_PRIMARY,
  HOME_BUTTON_3D_SECONDARY,
} from '@/lib/home-button-styles';

interface Props {
  meetings: Meeting[];
  externalEvents?: ExternalEvent[];
  onSelectMeeting: (meetingId: string) => void;
  onAddMeeting: (meeting: { title: string; startsAt: string; participants: string[]; meetLink?: string; notes?: string }) => void;
  onDeleteMeeting: (meetingId: string) => void;
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

// ── Calendly external events ──────────────────────────────────────────────
const SOURCE_LABEL: Record<ExternalEvent['source'], string> = {
  google_calendar: 'Google Cal',
  calendly: 'Calendly',
};
const SOURCE_BADGE: Record<ExternalEvent['source'], string> = {
  google_calendar: 'bg-blue-100 text-blue-700',
  calendly: 'bg-purple-100 text-purple-700',
};
// Calendly collapsed pill
const CALENDLY_PILL = 'bg-purple-500 text-white border-purple-400';

// ── App + GCal meetings ────────────────────────────────────────────────────
// Returns styles for a meeting based on its origin
function meetingPill(m: Meeting) {
  if (m.gcalId) return 'bg-blue-500 text-white border-blue-400';
  return 'bg-orange-500 text-white border-orange-400';
}
function meetingCardBorder(m: Meeting) {
  if (m.gcalId) return 'border-l-4 border-l-blue-400 bg-blue-50/40';
  return 'border-l-4 border-l-orange-400 bg-orange-50/20';
}
function meetingTimeBadge(m: Meeting) {
  if (m.gcalId) return 'bg-blue-100 text-blue-800';
  return 'bg-orange-100 text-orange-800';
}
function meetingSourceLabel(m: Meeting) {
  if (m.gcalId) return { label: 'Google Cal', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Manual', cls: 'bg-orange-100 text-orange-700' };
}
function meetingActionBtn(m: Meeting) {
  if (m.gcalId) return 'rounded-lg border font-semibold transition duration-150 border-blue-300 bg-blue-500 text-white hover:bg-blue-400';
  return 'rounded-lg border font-semibold transition duration-150 border-orange-300 bg-orange-500 text-white hover:bg-orange-400';
}

export default function ScheduledCalendarWindow({
  meetings,
  externalEvents = [],
  onSelectMeeting,
  onAddMeeting,
  onDeleteMeeting,
}: Props) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [addMeetingDate, setAddMeetingDate] = useState<string | null>(null);
  const [newMeetingForm, setNewMeetingForm] = useState({ title: '', time: '10:00', participants: '', meetLink: '' });

  const today = new Date();
  const days = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const meetingsByDate = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    const d = new Date(m.startsAt);
    if (Number.isNaN(d.getTime())) return acc;
    const key = toDateKey(d);
    acc[key] = [...(acc[key] ?? []), m];
    return acc;
  }, {});

  const externalByDate = externalEvents.reduce<Record<string, ExternalEvent[]>>((acc, e) => {
    const d = new Date(e.startsAt);
    if (Number.isNaN(d.getTime())) return acc;
    const key = toDateKey(d);
    acc[key] = [...(acc[key] ?? []), e];
    return acc;
  }, {});

  const openAddMeetingModal = (dateKey: string) => {
    setAddMeetingDate(dateKey);
    setNewMeetingForm({ title: '', time: '10:00', participants: '', meetLink: '' });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Calendar window</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-xs text-slate-500">Manual</span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ml-1" />
            <span className="text-xs text-slate-500">Google Cal</span>
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 ml-1" />
            <span className="text-xs text-slate-500">Calendly</span>
          </div>
          <p className="text-sm text-slate-500">Upcoming 10 days</p>
        </div>
      </div>

      <motion.div layout className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 auto-rows-[minmax(168px,auto)] relative">
        {days.map((day) => {
          const key = toDateKey(day);
          const dayMeetings = meetingsByDate[key] ?? [];
          const dayExternal = externalByDate[key] ?? [];
          const totalCount = dayMeetings.length + dayExternal.length;
          const isExpanded = expandedDay === key;

          return (
            <motion.div
              layout
              key={key}
              onClick={() => { if (!isExpanded) setExpandedDay(key); }}
              className={`group rounded-xl border transition-all flex flex-col overflow-hidden ${
                isExpanded
                  ? 'col-span-2 sm:col-span-3 row-span-2 border-orange-300 bg-white shadow-xl z-10'
                  : 'col-span-1 row-span-1 border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/30 hover:shadow-md cursor-pointer'
              }`}
              style={{ borderRadius: '0.75rem' }}
            >
              <motion.div layout="position" className="flex items-start justify-between gap-2 p-3 pb-0">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {day.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {isExpanded ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpandedDay(null); }}
                      className={`${HOME_BUTTON_3D_SECONDARY} !rounded-md h-8 w-8 p-0 text-sm leading-none flex items-center justify-center`}
                    >✕</button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openAddMeetingModal(key); }}
                      className={`${HOME_BUTTON_3D_SECONDARY} !rounded-md h-8 w-8 p-0 text-sm leading-none flex items-center justify-center`}
                      title="Add event on this date"
                    >+</button>
                  )}
                </div>
              </motion.div>

              <motion.div layout="position" className="mt-3 flex-1 flex flex-col p-3 pt-0 h-full">
                {isExpanded ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-[minmax(120px,auto)]"
                  >
                    {totalCount === 0 ? (
                      <div className="md:col-span-2 bg-slate-50/50 rounded-xl border border-slate-100 p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                        <span className="text-2xl mb-2">📅</span>
                        <h3 className="text-sm font-semibold text-slate-900">No meetings</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">Clear schedule for this day.</p>
                        <button onClick={(e) => { e.stopPropagation(); openAddMeetingModal(key); }} className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-2 text-xs`}>
                          Add Meeting
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Meetings (manual + GCal-imported) */}
                        {dayMeetings.map((meeting, index) => {
                          const src = meetingSourceLabel(meeting);
                          return (
                            <div
                              key={meeting.id}
                              className={`rounded-xl border border-slate-100 p-4 flex flex-col ${meetingCardBorder(meeting)} ${index === 0 && totalCount > 1 ? 'md:col-span-2' : 'col-span-1'}`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold text-slate-900 text-sm line-clamp-1 flex-1">{meeting.title}</h3>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${meetingTimeBadge(meeting)}`}>
                                  {new Date(meeting.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <span className={`self-start inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mb-2 ${src.cls}`}>
                                {src.label}
                              </span>

                              {meeting.notes && <p className="text-slate-600 text-xs mb-3 line-clamp-2">{meeting.notes}</p>}
                              <div className="flex flex-wrap gap-1 mt-auto">
                                {meeting.participants.slice(0, 2).map((p, i) => (
                                  <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-600">{p}</span>
                                ))}
                                {meeting.participants.length > 2 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-500">+{meeting.participants.length - 2}</span>
                                )}
                              </div>
                              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-200/60">
                                <button onClick={(e) => { e.stopPropagation(); onSelectMeeting(meeting.id); }} className={`flex-1 ${meetingActionBtn(meeting)} !text-xs py-1.5 px-3`}>
                                  Lets Goo
                                </button>
                                {meeting.meetLink && (
                                  <a href={meeting.meetLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`${HOME_BUTTON_3D_SECONDARY} !text-xs py-1.5 px-3`}>Join</a>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); onDeleteMeeting(meeting.id); }} className={`${HOME_BUTTON_3D_SECONDARY} !rounded-md h-7 w-7 shrink-0 p-0 text-[10px] flex items-center justify-center hover:!text-red-500`} title="Delete">✕</button>
                              </div>
                            </div>
                          );
                        })}

                        {/* External events (GCal / Calendly) */}
                        {dayExternal.map((event) => (
                          <div key={event.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col col-span-1">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-slate-900 text-sm line-clamp-1">{event.title}</h3>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                                {new Date(event.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span className={`self-start inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mb-3 ${SOURCE_BADGE[event.source]}`}>
                              {SOURCE_LABEL[event.source]}
                            </span>
                            <div className="mt-auto pt-3 border-t border-slate-200/60 flex items-center gap-2">
                              {event.meetLink && (
                                <a href={event.meetLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`flex-1 text-center ${HOME_BUTTON_3D_SECONDARY} !text-xs py-1.5`}>Join</a>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Add meeting slot */}
                        <div
                          className="bg-orange-50/50 rounded-xl border border-orange-100 p-4 flex flex-col items-center justify-center text-center hover:bg-orange-50 transition-colors cursor-pointer min-h-[120px]"
                          onClick={(e) => { e.stopPropagation(); openAddMeetingModal(key); }}
                        >
                          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mb-2 text-orange-500 shadow-sm">
                            <span className="text-lg leading-none">+</span>
                          </div>
                          <p className="text-xs font-medium text-orange-800">Add Meeting</p>
                        </div>
                      </>
                    )}
                  </motion.div>
                ) : (
                  // COLLAPSED VIEW
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
                    <div className="space-y-1.5">
                      {totalCount === 0 ? (
                        <p className="text-[11px] text-slate-400">No meetings</p>
                      ) : (
                        <>
                          {dayMeetings.map((m) => (
                            <div key={m.id} className={`truncate rounded-md px-2 py-1 text-[11px] font-semibold border ${meetingPill(m)}`} title={m.title}>
                              {m.title}
                            </div>
                          ))}
                          {dayExternal.map((e) => (
                            <div key={e.id} className={`truncate rounded-md px-2 py-1 text-[11px] font-semibold border ${CALENDLY_PILL}`} title={e.title}>
                              {e.title}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="mt-auto pt-3 flex items-center justify-end text-slate-300 group-hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                      <span className="text-[10px] font-medium mr-1.5">Click to expand</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
                      </svg>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Add Meeting Modal */}
      <AnimatePresence>
        {addMeetingDate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddMeetingDate(null)} className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm" />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl pointer-events-auto border border-slate-200"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-slate-900">Add New Meeting</h3>
                  <button onClick={() => setAddMeetingDate(null)} className={`${HOME_BUTTON_3D_SECONDARY} !rounded-full w-8 h-8 flex items-center justify-center`}>✕</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Title</label>
                    <input type="text" placeholder="Meeting title" value={newMeetingForm.title} onChange={(e) => setNewMeetingForm({ ...newMeetingForm, title: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date</label>
                      <input type="date" value={addMeetingDate} onChange={(e) => setAddMeetingDate(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Time</label>
                      <input type="time" value={newMeetingForm.time} onChange={(e) => setNewMeetingForm({ ...newMeetingForm, time: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Attendees</label>
                    <input type="text" placeholder="Comma separated names" value={newMeetingForm.participants} onChange={(e) => setNewMeetingForm({ ...newMeetingForm, participants: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Meeting Link</label>
                    <input type="url" placeholder="https://" value={newMeetingForm.meetLink} onChange={(e) => setNewMeetingForm({ ...newMeetingForm, meetLink: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400" />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                  <button onClick={() => setAddMeetingDate(null)} className={`${HOME_BUTTON_3D_SECONDARY} px-4 py-2 text-sm`}>Cancel</button>
                  <button
                    onClick={() => {
                      const startsAt = `${addMeetingDate}T${newMeetingForm.time || '10:00'}`;
                      const participants = newMeetingForm.participants.split(',').map((p) => p.trim()).filter(Boolean);
                      onAddMeeting({ title: newMeetingForm.title.trim() || 'Untitled Meeting', startsAt, participants, meetLink: newMeetingForm.meetLink.trim() || undefined });
                      setAddMeetingDate(null);
                    }}
                    className={`${HOME_BUTTON_3D_PRIMARY} px-6 py-2 text-sm`}
                  >Save Meeting</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
