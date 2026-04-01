import React, { useState, useEffect } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isSameDay, 
  addWeeks, 
  subWeeks,
  addDays,
  subDays,
  parseISO,
  isWithinInterval
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Plus } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cn } from "../lib/utils";
import { Booking, Room } from "../types";
import { BookingModal } from "./BookingModal";
import { BookingDetailsModal } from "./BookingDetailsModal";

type ViewType = "month" | "week" | "day";

export function CalendarView() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("month");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [settings, setSettings] = useState({ work_start_time: "08:00", work_end_time: "18:00", slot_duration_minutes: "60" });
  
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    // Fetch bookings for a wide range to cover month/week/day
    const start = format(startOfMonth(subMonths(currentDate, 1)), "yyyy-MM-dd");
    const end = format(endOfMonth(addMonths(currentDate, 1)), "yyyy-MM-dd");
    const res = await fetch(`/api/bookings?start=${start}&end=${end}`);
    const data = await res.json();
    setBookings(data);
  };

  const fetchRooms = async () => {
    const res = await fetch("/api/rooms");
    const data = await res.json();
    setRooms(data);
  };

  const fetchSettings = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data);
  };

  useEffect(() => {
    fetchBookings();
    fetchRooms();
    fetchSettings();
  }, [currentDate]);

  const next = () => {
    if (view === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (view === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDateForBooking(format(date, "yyyy-MM-dd"));
    setIsBookingModalOpen(true);
  };

  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setSelectedBooking(booking);
    setIsDetailsModalOpen(true);
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 border-t border-l border-slate-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-r border-b border-slate-200">
            {day}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const dayBookings = bookings.filter(b => isSameDay(parseISO(b.start_datetime), day) && b.status === 'confirmed');
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={i} 
              onClick={() => handleDateClick(day)}
              className={cn(
                "min-h-[100px] md:min-h-[140px] p-2 md:p-3 border-r border-b border-slate-200 transition-colors cursor-pointer hover:bg-slate-50",
                !isCurrentMonth && "bg-slate-50/50 text-slate-400"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <span className={cn(
                  "text-base font-bold w-8 h-8 flex items-center justify-center rounded-full",
                  isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                )}>
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-1.5">
                {dayBookings.slice(0, 4).map(b => (
                  <div 
                    key={b.id}
                    onClick={(e) => handleBookingClick(e, b)}
                    className={cn(
                      "text-xs px-2 py-1 rounded truncate font-semibold border",
                      b.refreshment_request === 1
                        ? "bg-orange-50 border-orange-200 text-orange-700"
                        : b.user_id === user?.id 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    )}
                    title={`${b.room_name}: ${b.title}`}
                  >
                    <span className="font-bold">{format(parseISO(b.start_datetime), "HH:mm")}</span> {b.title}
                  </div>
                ))}
                {dayBookings.length > 4 && (
                  <div className="text-[10px] text-slate-400 pl-1">
                    + {dayBookings.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const weekDays = eachDayOfInterval({ start: startDate, end: addWeeks(startDate, 1) }).slice(0, 7);
    const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM to 7 PM

    return (
      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
          <div className="p-3 border-r border-slate-200"></div>
          {weekDays.map(day => (
            <div key={day.toString()} className="p-3 text-center border-r border-slate-200 last:border-r-0">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{format(day, "EEE")}</div>
              <div className={cn(
                "text-lg font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full",
                isSameDay(day, new Date()) ? "bg-indigo-600 text-white" : "text-slate-700"
              )}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto max-h-[600px]">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-100 last:border-b-0">
              <div className="p-2 text-[10px] font-medium text-slate-400 text-right border-r border-slate-200 bg-slate-50/30">
                {hour}:00
              </div>
              {weekDays.map(day => {
                const hourBookings = bookings.filter(b => {
                  const start = parseISO(b.start_datetime);
                  return isSameDay(start, day) && start.getHours() === hour && b.status === 'confirmed';
                });

                return (
                  <div 
                    key={day.toString() + hour} 
                    onClick={() => handleDateClick(day)}
                    className="p-1 border-r border-slate-100 last:border-r-0 min-h-[60px] relative hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {hourBookings.map(b => (
                      <div 
                        key={b.id}
                        onClick={(e) => handleBookingClick(e, b)}
                        className={cn(
                          "text-[10px] p-1 rounded mb-1 truncate font-medium border shadow-sm",
                          b.refreshment_request === 1
                            ? "bg-orange-50 border-orange-200 text-orange-700"
                            : b.user_id === user?.id 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        )}
                      >
                        <div className="font-bold truncate">{b.title}</div>
                        <div className="opacity-80 truncate">{b.room_name}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM to 8 PM
    const dayBookings = bookings.filter(b => isSameDay(parseISO(b.start_datetime), currentDate) && b.status === 'confirmed');

    return (
      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white max-w-3xl mx-auto">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-slate-900">{format(currentDate, "d")}</div>
            <div>
              <div className="text-base font-bold text-slate-900">{format(currentDate, "EEEE")}</div>
              <div className="text-sm text-slate-500">{format(currentDate, "MMMM yyyy")}</div>
            </div>
          </div>
          <button 
            onClick={() => handleDateClick(currentDate)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-5 w-5" /> Book
          </button>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[600px]">
          {hours.map(hour => {
            const hourBookings = dayBookings.filter(b => parseISO(b.start_datetime).getHours() === hour);
            
            return (
              <div key={hour} className="flex border-b border-slate-100 last:border-b-0 group">
                <div className="w-24 p-5 text-sm font-bold text-slate-400 text-right border-r border-slate-100 bg-slate-50/30">
                  {hour}:00
                </div>
                <div className="flex-1 p-3 min-h-[100px] space-y-3 group-hover:bg-slate-50/50 transition-colors">
                  {hourBookings.map(b => (
                    <div 
                      key={b.id}
                      onClick={(e) => handleBookingClick(e, b)}
                      className={cn(
                        "p-4 rounded-xl border shadow-sm cursor-pointer transition-all hover:scale-[1.01]",
                        b.refreshment_request === 1
                          ? "bg-orange-50 border-orange-200 text-orange-700"
                          : b.user_id === user?.id 
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-base">{b.title}</div>
                          <div className="flex items-center gap-4 mt-2 text-xs font-medium opacity-80">
                            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {b.room_name}</span>
                            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {format(parseISO(b.start_datetime), "HH:mm")} - {format(parseISO(b.end_datetime), "HH:mm")}</span>
                          </div>
                        </div>
                        <div className="text-xs font-bold opacity-60">{b.user_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Calendar</h1>
          <p className="text-slate-500 text-sm mt-1">View and manage meeting room schedules</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setView("month")}
            className={cn("px-4 py-1.5 text-xs font-semibold rounded-lg transition-all", view === "month" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50")}
          >
            Month
          </button>
          <button 
            onClick={() => setView("week")}
            className={cn("px-4 py-1.5 text-xs font-semibold rounded-lg transition-all", view === "week" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50")}
          >
            Week
          </button>
          <button 
            onClick={() => setView("day")}
            className={cn("px-4 py-1.5 text-xs font-semibold rounded-lg transition-all", view === "day" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50")}
          >
            Day
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
            <button onClick={prev} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-slate-900 px-2 min-w-[120px] text-center">
              {view === "month" ? format(currentDate, "MMMM yyyy") : 
               view === "week" ? `Week of ${format(startOfWeek(currentDate), "MMM d")}` :
               format(currentDate, "MMMM d, yyyy")}
            </span>
            <button onClick={next} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button 
            onClick={() => {
              const today = new Date();
              setCurrentDate(today);
              fetchBookings(); // Force refresh
            }}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-colors shadow-sm"
          >
            Today
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {view === "month" && renderMonthView()}
        {view === "week" && renderWeekView()}
        {view === "day" && renderDayView()}
      </div>

      {isBookingModalOpen && (
        <BookingModal
          roomId={null}
          rooms={rooms}
          date={selectedDateForBooking}
          settings={settings}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => {
            setIsBookingModalOpen(false);
            fetchBookings();
          }}
        />
      )}

      {isDetailsModalOpen && selectedBooking && (
        <BookingDetailsModal 
          booking={selectedBooking} 
          onClose={() => setIsDetailsModalOpen(false)} 
          onCancelSuccess={fetchBookings}
        />
      )}
    </div>
  );
}
