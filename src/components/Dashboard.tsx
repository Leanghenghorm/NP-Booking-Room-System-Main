import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { format, isAfter, isBefore, parseISO, startOfDay, endOfDay, differenceInMinutes, parse } from "date-fns";
import { Calendar, Clock, MapPin, Users, Plus, Trash2, Edit2, Settings, CalendarDays } from "lucide-react";
import { cn } from "../lib/utils";
import { Room, Booking } from "../types";
import { BookingModal } from "./BookingModal";
import { BookingDetailsModal } from "./BookingDetailsModal";
import { ConfirmationModal } from "./ConfirmationModal";

export function Dashboard({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isBookingDetailsModalOpen, setIsBookingDetailsModalOpen] = useState(false);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [settings, setSettings] = useState({ work_start_time: "08:00", work_end_time: "18:00", slot_duration_minutes: "60" });
  const [holidays, setHolidays] = useState<any[]>([]);

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

  const fetchRooms = async () => {
    const res = await fetch("/api/rooms");
    const data = await res.json();
    setRooms(data);
  };

  const fetchBookings = async () => {
    const res = await fetch(`/api/bookings?date=${selectedDate}`);
    const data = await res.json();
    setBookings(data);
  };

  const fetchSettings = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data);
  };

  const fetchHolidays = async () => {
    const res = await fetch("/api/holidays");
    const data = await res.json();
    setHolidays(data);
  };

  useEffect(() => {
    fetchRooms();
    fetchSettings();
    fetchHolidays();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [selectedDate]);

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

  const openBookingModal = (roomId: number) => {
    setSelectedRoomId(roomId);
    setIsBookingModalOpen(true);
  };

  const getRoomAvailability = (room: Room) => {
    if (room.status === 'maintenance') {
      return { status: "maintenance" };
    }
    const now = new Date();
    const roomBookings = bookings.filter(b => b.room_id === room.id && b.status === "confirmed");
    
    const currentBooking = roomBookings.find(b => {
      const start = parseISO(b.start_datetime);
      const end = parseISO(b.end_datetime);
      return isBefore(start, now) && isAfter(end, now);
    });

    if (currentBooking) {
      return { status: "blocked", booking: currentBooking };
    }
    return { status: "available" };
  };

  const openBookingDetails = (booking: Booking) => {
    setSelectedBookingForDetails(booking);
    setIsBookingDetailsModalOpen(true);
  };

  const renderTimeline = (roomBookings: Booking[]) => {
    const startHour = parseInt(settings.work_start_time.split(":")[0]);
    const endHour = parseInt(settings.work_end_time.split(":")[0]);
    const totalMinutes = (endHour - startHour) * 60;

    const confirmedBookings = roomBookings.filter(b => b.status === "confirmed");

    return (
      <div className="mt-4">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1 px-1">
          <span>{startHour}:00</span>
          <span>{Math.floor((startHour + endHour) / 2)}:00</span>
          <span>{endHour}:00</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full relative overflow-hidden">
          {confirmedBookings.map(booking => {
            const start = parseISO(booking.start_datetime);
            const end = parseISO(booking.end_datetime);
            
            const startMins = start.getHours() * 60 + start.getMinutes();
            const endMins = end.getHours() * 60 + end.getMinutes();
            
            const offsetMins = Math.max(0, startMins - (startHour * 60));
            const durationMins = Math.min(totalMinutes - offsetMins, endMins - Math.max(startMins, startHour * 60));
            
            if (offsetMins >= totalMinutes || durationMins <= 0) return null;

            const leftPercent = (offsetMins / totalMinutes) * 100;
            const widthPercent = (durationMins / totalMinutes) * 100;

            return (
              <div 
                key={booking.id}
                className="absolute top-0 bottom-0 bg-indigo-500 rounded-full cursor-pointer hover:bg-indigo-600 transition-colors"
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                title={`${format(start, "HH:mm")} - ${format(end, "HH:mm")}: ${booking.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openBookingDetails(booking);
                }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  if (!user) return null;

  const isHoliday = holidays.some(h => h.date === selectedDate);
  const holidayDescription = holidays.find(h => h.date === selectedDate)?.description;
  const isPastDate = isBefore(endOfDay(parseISO(selectedDate)), new Date());

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Meeting Rooms</h1>
          <p className="text-slate-500 text-sm mt-1">Book and manage meeting spaces</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange("calendar")}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-100"
          >
            <CalendarDays className="h-4 w-4" />
            Display Calendar
          </button>
          
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
            <Calendar className="h-4 w-4 text-slate-400 ml-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
            />
          </div>
          {(user.role === "admin" || user.role === "super_admin") && (
            <button 
              onClick={() => {
                setEditingRoom(null);
                setIsRoomModalOpen(true);
              }}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Room
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isHoliday && (
          <div className="lg:col-span-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
            <Calendar className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">Holiday: {holidayDescription}</p>
              <p className="text-sm text-amber-700">Bookings are disabled for this date.</p>
            </div>
          </div>
        )}
        {rooms.map(room => {
          const availability = getRoomAvailability(room);
          const roomBookings = bookings.filter(b => b.room_id === room.id);

          return (
            <div key={room.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{room.name}</h2>
                      {(user.role === "admin" || user.role === "super_admin") && (
                        <button
                          onClick={() => {
                            setEditingRoom(room);
                            setIsRoomModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-base text-slate-500">
                      <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {room.location}</span>
                      <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {room.capacity}</span>
                    </div>
                  </div>
                  <span 
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider",
                      availability.status === "available" ? "bg-emerald-50 text-emerald-700" : 
                      availability.status === "maintenance" ? "bg-amber-50 text-amber-700" :
                      "bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                    )}
                    onClick={() => {
                      if (availability.status === "blocked" && availability.booking) {
                        openBookingDetails(availability.booking);
                      }
                    }}
                  >
                    {availability.status}
                  </span>
                </div>
                
                {renderTimeline(roomBookings)}
                
                <button
                  onClick={() => openBookingModal(room.id)}
                  disabled={room.status !== 'active' || isHoliday || isPastDate}
                  className="mt-6 w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-5 w-5" /> {room.status === 'active' ? (isHoliday ? 'Holiday' : (isPastDate ? 'Past Date' : 'Book Room')) : 'Maintenance'}
                </button>
              </div>

              <div className="flex-1 p-6 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Today's Schedule</h3>
                
                <div className="space-y-3">
                  {roomBookings.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No bookings for this date.</p>
                  ) : (
                    roomBookings.map(booking => {
                      const canEdit = user.role === "admin" || user.role === "super_admin" || user.id === booking.user_id;
                      
                      return (
                        <div 
                          key={booking.id} 
                          className={cn(
                            "p-3 rounded-xl border shadow-sm relative group cursor-pointer transition-all",
                            booking.status === "cancelled" 
                              ? "border-gray-400 opacity-60 bg-gray-50 hover:bg-gray-100" 
                              : booking.refreshment_request === 1
                                ? "border-orange-500 bg-orange-50 hover:bg-orange-100 hover:border-orange-600 active:bg-orange-200"
                                : "border-green-500 bg-white hover:bg-green-50 hover:border-green-600 active:bg-green-100"
                          )}
                          onClick={() => openBookingDetails(booking)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="truncate pr-8">
                              <div className="font-bold text-base text-slate-900 truncate">{booking.title}</div>
                              <div className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                {format(parseISO(booking.start_datetime), "HH:mm")} - {format(parseISO(booking.end_datetime), "HH:mm")}
                              </div>
                              <div className="text-sm text-slate-500 mt-1">
                                <span className="font-semibold text-slate-700">{booking.user_name}</span> • {booking.department_name}
                              </div>
                            </div>
                            
                            {booking.status === "cancelled" && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Cancelled</span>
                            )}
                          </div>
                          
                          {canEdit && booking.status === "confirmed" && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelBooking(booking.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Cancel Booking"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {isBookingModalOpen && selectedRoomId && (
        <BookingModal
          roomId={selectedRoomId}
          date={selectedDate}
          settings={settings}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => {
            setIsBookingModalOpen(false);
            fetchBookings();
          }}
        />
      )}

      {isRoomModalOpen && (
        <RoomModal
          room={editingRoom}
          onClose={() => {
            setIsRoomModalOpen(false);
            setEditingRoom(null);
          }}
          onSuccess={() => {
            setIsRoomModalOpen(false);
            setEditingRoom(null);
            fetchRooms();
          }}
        />
      )}

      {isBookingDetailsModalOpen && selectedBookingForDetails && (
        <BookingDetailsModal 
          booking={selectedBookingForDetails} 
          onClose={() => setIsBookingDetailsModalOpen(false)} 
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

function RoomModal({ room, onClose, onSuccess }: { room: Room | null, onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(room?.name || "");
  const [location, setLocation] = useState(room?.location || "");
  const [capacity, setCapacity] = useState(room?.capacity || 10);
  const [status, setStatus] = useState<"active" | "maintenance">(room?.status || "active");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Confirmation Modal State for Room Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = room ? `/api/rooms/${room.id}` : "/api/rooms";
      const method = room ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location, capacity, status })
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || `Failed to ${room ? "update" : "create"} room`);
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!room) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete room");
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{room ? "Edit Room" : "Add New Room"}</h2>
              <p className="text-sm text-slate-500 mt-1">{room ? "Update room details" : "Create a new meeting space"}</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">Room Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                placeholder="e.g. Apollo"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">Location</label>
              <input
                type="text"
                required
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                placeholder="e.g. Floor 1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-bold text-slate-700 mb-2">Capacity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={capacity}
                  onChange={e => setCapacity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as "active" | "maintenance")}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base bg-white"
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>

            </div>
            <div className="p-5 sm:p-6 border-t border-slate-100 shrink-0 flex flex-col gap-3 bg-slate-50">
              <div className="flex gap-3">
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
                  {loading ? "Saving..." : (room ? "Save Room" : "Create Room")}
                </button>
              </div>
              {room && (user.role === "admin" || user.role === "super_admin") && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  className="w-full px-4 py-3 sm:py-2 text-sm font-medium text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Delete Room
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Room"
        message="Are you sure you want to delete this room? It will be marked as inactive and removed from the list."
        confirmText="Delete Room"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
