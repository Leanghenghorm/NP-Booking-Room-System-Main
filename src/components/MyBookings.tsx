import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { format, parseISO, isBefore, isAfter, parse } from "date-fns";
import { Clock, MapPin, Building2, Trash2, Edit2, Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { Booking } from "../types";
import { BookingDetailsModal } from "./BookingDetailsModal";
import { ConfirmationModal } from "./ConfirmationModal";

export function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "past" | "cancelled">("upcoming");
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [settings, setSettings] = useState({ work_start_time: "08:00", work_end_time: "18:00", slot_duration_minutes: "60" });

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    confirmText: "Confirm"
  });

  const fetchBookings = async () => {
    if (!user) return;
    const res = await fetch(`/api/my-bookings?user_id=${user.id}`);
    const data = await res.json();
    setBookings(data);
  };

  const fetchSettings = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data);
  };

  useEffect(() => {
    fetchBookings();
    fetchSettings();
  }, [user]);

  const handleCancelBooking = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Cancel Booking",
      message: "Are you sure you want to cancel this booking? This action cannot be undone.",
      confirmText: "Cancel Booking",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/bookings/${id}?user_id=${user?.id}`, { method: "DELETE" });
          if (res.ok) {
            fetchBookings();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          } else {
            const err = await res.json();
            alert(err.error || "Failed to cancel booking");
          }
        } catch (err: any) {
          console.error(err);
          alert(`Error: ${err.message}`);
        }
      }
    });
  };

  const filteredBookings = bookings.filter(b => {
    const now = new Date();
    const end = parseISO(b.end_datetime);
    
    if (filter === "cancelled") return b.status === "cancelled";
    if (filter === "past") return b.status !== "cancelled" && isBefore(end, now);
    if (filter === "upcoming") return b.status !== "cancelled" && isAfter(end, now);
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Bookings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your upcoming and past reservations</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(["upcoming", "past", "cancelled"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors",
                filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No {filter} bookings found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredBookings.map(booking => {
              const start = parseISO(booking.start_datetime);
              const end = parseISO(booking.end_datetime);
              const isUpcoming = isAfter(end, new Date()) && booking.status === "confirmed";

              return (
                <div 
                  key={booking.id} 
                  className="p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedBookingForDetails(booking)}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-900">{booking.title}</h3>
                      <span className={cn(
                        "px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full",
                        booking.status === "cancelled" ? "bg-slate-100 text-slate-500" :
                        isUpcoming ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {booking.status === "cancelled" ? "Cancelled" : isUpcoming ? "Upcoming" : "Past"}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-base text-slate-500 mt-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-slate-400" />
                        <span className="font-bold text-slate-700">{format(start, "MMM d, yyyy")}</span>
                        <span className="text-slate-300">|</span>
                        <span className="font-semibold">{format(start, "HH:mm")} - {format(end, "HH:mm")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-slate-400" />
                        <span className="font-bold text-slate-700">{booking.room_name}</span>
                      </div>
                      {booking.refreshment_request === 1 && (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                            Refreshment Requested
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {booking.description && (
                      <p className="text-base text-slate-600 mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                        {booking.description}
                      </p>
                    )}
                  </div>

                  {booking.status === "confirmed" && (
                    <div className="flex gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                      {isUpcoming && (
                        <button
                          onClick={() => setEditingBooking(booking)}
                          className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit2 className="h-4 w-4" /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          settings={settings}
          onClose={() => setEditingBooking(null)}
          onCancelBooking={handleCancelBooking}
          onSuccess={() => {
            setEditingBooking(null);
            fetchBookings();
          }}
        />
      )}

      {selectedBookingForDetails && (
        <BookingDetailsModal 
          booking={selectedBookingForDetails} 
          onClose={() => setSelectedBookingForDetails(null)} 
          onCancelSuccess={fetchBookings}
        />
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

function EditBookingModal({ booking, settings, onClose, onSuccess, onCancelBooking }: { booking: Booking, settings: any, onClose: () => void, onSuccess: () => void, onCancelBooking: (id: number) => void }) {
  const [title, setTitle] = useState(booking.title);
  const [description, setDescription] = useState(booking.description || "");
  
  const start = parseISO(booking.start_datetime);
  const end = parseISO(booking.end_datetime);
  
  const [date, setDate] = useState(format(start, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(start, "HH:mm"));
  const [endTime, setEndTime] = useState(format(end, "HH:mm"));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/rooms/${booking.room_id}/availability?date=${date}`)
      .then(res => res.json())
      .then(data => setAvailability(data.filter((b: any) => b.id !== booking.id))); // Exclude current booking
  }, [booking.room_id, booking.id, date]);

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
      
      // Check if this slot is booked
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
    setError("");
    setLoading(true);

    const start_datetime = `${date}T${startTime}:00`;
    const end_datetime = `${date}T${endTime}:00`;

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          start_datetime,
          end_datetime
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to update booking");
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Edit Booking</h2>
          <p className="text-sm text-slate-500 mt-1">{booking.room_name}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">
              {error}
            </div>
          )}
          
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
              <select
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                {timeSlots.map(slot => (
                  <option key={`start-${slot.start}`} value={slot.start} disabled={slot.status !== 'available'}>{slot.start}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
              <select
                required
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                {timeSlots.map(slot => (
                  <option key={`end-${slot.end}`} value={slot.end} disabled={slot.start < startTime || slot.status !== 'available'}>{slot.end}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none h-20"
            />
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onCancelBooking(booking.id);
                onClose();
              }}
              className="w-full px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Cancel Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
