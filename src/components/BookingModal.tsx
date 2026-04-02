import { useState, useEffect, FormEvent } from "react";
import { format, isBefore, parseISO, parse } from "date-fns";
import { useAuth } from "./AuthProvider";
import { cn } from "../lib/utils";
import { Room } from "../types";
import { motion, AnimatePresence } from "motion/react";

export function BookingModal({ roomId, date, settings, onClose, onSuccess, rooms }: { roomId: number | null, date: string, settings: any, onClose: () => void, onSuccess: () => void, rooms?: Room[] }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(settings.work_start_time);
  const [endTime, setEndTime] = useState(settings.work_end_time);
  const [isRange, setIsRange] = useState(false);
  const [endDate, setEndDate] = useState(date);
  const [refreshmentRequest, setRefreshmentRequest] = useState(false);
  const [participantCount, setParticipantCount] = useState<number | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(roomId);

  useEffect(() => {
    if (selectedRoomId) {
      fetch(`/api/rooms/${selectedRoomId}/availability?date=${date}`)
        .then(res => res.json())
        .then(data => setAvailability(data));
    }
  }, [selectedRoomId, date]);

  const generateTimeSlots = () => {
    const startHour = parseInt(settings.work_start_time.split(":")[0]);
    const endHour = parseInt(settings.work_end_time.split(":")[0]);
    const duration = parseInt(settings.slot_duration_minutes);
    
    const slots = [];
    let currentMins = startHour * 60;
    const endMins = endHour * 60;
    
    while (currentMins < endMins) {
      const h = Math.floor(currentMins / 60).toString().padStart(2, '0');
      const m = (currentMins % 60).toString().padStart(2, '0');
      const timeStr = `${h}:${m}`;
      
      const nextMins = currentMins + duration;
      const nh = Math.floor(nextMins / 60).toString().padStart(2, '0');
      const nm = (nextMins % 60).toString().padStart(2, '0');
      const nextTimeStr = `${nh}:${nm}`;
      
      const slotDateTime = parse(`${date} ${timeStr}`, "yyyy-MM-dd HH:mm", new Date());
      const isPastSlot = isBefore(slotDateTime, new Date());
      
      const isBooked = availability.find(b => {
        const bStart = format(parseISO(b.start_datetime), "HH:mm");
        const bEnd = format(parseISO(b.end_datetime), "HH:mm");
        return (timeStr >= bStart && timeStr < bEnd) || (nextTimeStr > bStart && nextTimeStr <= bEnd) || (timeStr <= bStart && nextTimeStr >= bEnd);
      });

      slots.push({ 
        start: timeStr, 
        end: nextTimeStr, 
        status: isBooked ? 'booked' : (isPastSlot ? 'past' : 'available'),
        bookedBy: isBooked ? `${isBooked.booked_by} (${isBooked.department})` : null
      });
      currentMins = nextMins;
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) {
      setError("Please select a room");
      return;
    }
    setError("");
    setLoading(true);

    const start_datetime = `${date}T${startTime}:00`;
    const end_datetime = `${date}T${endTime}:00`;

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: selectedRoomId,
          user_id: user?.id,
          title,
          description,
          start_datetime,
          end_datetime,
          is_range: isRange,
          end_date: endDate,
          refreshment_request: refreshmentRequest,
          participant_count: participantCount || 0
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to create booking");
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]"
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">New Booking</h2>
            <p className="text-sm text-slate-500 mt-1">Schedule a meeting room</p>
          </div>
          <button onClick={onClose} className="sm:hidden p-2 text-slate-400 hover:text-slate-600">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">
              {error}
            </div>
          )}

          {rooms && (
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">Select Room</label>
              <select
                required
                value={selectedRoomId || ""}
                onChange={e => setSelectedRoomId(Number(e.target.value))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base bg-white"
              >
                <option value="" disabled>Select a room</option>
                {rooms.filter(r => r.status === 'active').map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.location})</option>
                ))}
              </select>
            </div>
          )}
          
          {selectedRoomId && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Availability Grid for {date}</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {timeSlots.map((slot, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "text-xs p-2 rounded-lg border text-center cursor-pointer transition-colors",
                      slot.status === 'booked' ? "bg-rose-50 border-rose-200 text-rose-700 cursor-not-allowed" : 
                      slot.status === 'past' ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" :
                      (startTime <= slot.start && endTime >= slot.end) ? "bg-indigo-600 border-indigo-600 text-white" :
                      "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                    )}
                    title={slot.status === 'past' ? "Past time" : (slot.bookedBy || "Available")}
                    onClick={() => {
                      if (slot.status === 'available') {
                        if (startTime === slot.start) {
                          setEndTime(slot.end);
                        } else {
                          setStartTime(slot.start);
                          setEndTime(slot.end);
                        }
                      }
                    }}
                  >
                    <div className="font-medium">{slot.start}</div>
                    <div className="text-[10px] opacity-80">{slot.end}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-base font-bold text-slate-700 mb-2">Meeting Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
              placeholder="e.g. Q3 Planning"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">Start Time</label>
              <select
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base bg-white"
              >
                {timeSlots.map(slot => (
                  <option key={`start-${slot.start}`} value={slot.start} disabled={slot.status !== 'available'}>{slot.start}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">End Time</label>
              <select
                required
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base bg-white"
              >
                {timeSlots.map(slot => (
                  <option key={`end-${slot.end}`} value={slot.end} disabled={slot.start < startTime || slot.status !== 'available'}>{slot.end}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRange}
                onChange={e => setIsRange(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Repeat for multiple days</span>
            </label>
            
            {isRange && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  required={isRange}
                  min={date}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={refreshmentRequest}
                onChange={e => setRefreshmentRequest(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Refreshment Request</span>
            </label>
            
            {refreshmentRequest && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">How many members will join?</label>
                <input
                  type="number"
                  required={refreshmentRequest}
                  min="1"
                  value={participantCount}
                  onChange={e => setParticipantCount(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Enter number of members"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none h-20"
              placeholder="Add any additional details..."
            />
          </div>

          </div>
          <div className="p-5 sm:p-6 border-t border-slate-100 shrink-0 flex gap-3 bg-slate-50 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 sm:py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 sm:py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
