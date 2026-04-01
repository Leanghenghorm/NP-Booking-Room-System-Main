import { format, parseISO, isAfter } from "date-fns";
import { Clock, Calendar, Plus, Trash2 } from "lucide-react";
import { Booking } from "../types";
import { useAuth } from "./AuthProvider";
import { useState } from "react";
import { ConfirmationModal } from "./ConfirmationModal";

export function BookingDetailsModal({ booking, onClose, onCancelSuccess }: { booking: Booking, onClose: () => void, onCancelSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const start = parseISO(booking.start_datetime);
  const end = parseISO(booking.end_datetime);

  const canCancel = booking.status === "confirmed" && 
    (user?.role === "admin" || user?.role === "super_admin" || user?.id === booking.user_id);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}?user_id=${user?.id}`, { method: "DELETE" });
      if (res.ok) {
        if (onCancelSuccess) onCancelSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to cancel booking");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Booking Details</h2>
              <p className="text-sm text-slate-500 mt-1">Information about this reservation</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
              <Plus className="h-5 w-5 rotate-45" />
            </button>
          </div>
          
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Meeting Title</h3>
              <p className="text-xl font-bold text-slate-900">{booking.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Time</h3>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <span className="text-base font-bold">{format(start, "HH:mm")} - {format(end, "HH:mm")}</span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Date</h3>
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <span className="text-base font-bold">{format(start, "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Booked By</h3>
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                  {booking.user_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">{booking.user_name}</p>
                  <p className="text-sm text-slate-500">{booking.department_name}</p>
                </div>
              </div>
            </div>

            {booking.refreshment_request === 1 && (
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-2">Refreshment Requested</h3>
                <p className="text-base font-medium text-emerald-900">
                  For {booking.participant_count} participant{booking.participant_count !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {booking.description && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-base text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {booking.description}
                </p>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
            {canCancel ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={loading}
                className="flex items-center gap-2 text-rose-600 hover:text-rose-700 text-sm font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Cancel Booking
              </button>
            ) : <div />}
            
            <button
              onClick={onClose}
              className="px-6 py-3 sm:py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showCancelConfirm}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Cancel Booking"
        onConfirm={handleCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </>
  );
}
