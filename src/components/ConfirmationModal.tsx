import { AlertTriangle, X } from "lucide-react";
import { motion } from "motion/react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDanger = true
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
      >
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${isDanger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-600 leading-relaxed">{message}</p>
        </div>
        
        <div className="p-4 sm:p-5 bg-slate-50 flex gap-3 shrink-0 border-t border-slate-100 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 sm:py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 sm:py-2 text-sm font-medium text-white rounded-xl transition-colors ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
