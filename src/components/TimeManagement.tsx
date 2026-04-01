import { useState, useEffect, FormEvent } from "react";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { format, parseISO } from "date-fns";

type Holiday = {
  id: number;
  date: string;
  description: string;
};

export function TimeManagement() {
  const [settings, setSettings] = useState({
    work_start_time: "08:00",
    work_end_time: "18:00",
    slot_duration_minutes: "60",
    telegram_bot_token: "",
    telegram_chat_id: ""
  });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchData = async () => {
    try {
      const [settingsRes, holidaysRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/holidays")
      ]);
      const settingsData = await settingsRes.json();
      const holidaysData = await holidaysRes.json();
      
      setSettings(settingsData);
      setHolidays(holidaysData);
    } catch (err) {
      console.error("Failed to fetch time management data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setSuccess("Settings saved successfully.");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save settings.");
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newHolidayDate, description: newHolidayDesc })
      });

      if (res.ok) {
        setNewHolidayDate("");
        setNewHolidayDesc("");
        fetchData();
        setSuccess("Holiday added successfully.");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add holiday.");
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHoliday = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/holidays/${editingHoliday.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editingHoliday.date, description: editingHoliday.description })
      });

      if (res.ok) {
        setEditingHoliday(null);
        fetchData();
        setSuccess("Holiday updated successfully.");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update holiday.");
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;
    
    try {
      const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
        setSuccess("Holiday deleted successfully.");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete holiday.");
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Time Management</h1>
        <p className="text-slate-500 text-sm mt-1">Configure global working hours and holidays</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Working Configuration</h2>
          </div>
          <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={settings.work_start_time}
                  onChange={e => setSettings({ ...settings, work_start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={settings.work_end_time}
                  onChange={e => setSettings({ ...settings, work_end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slot Duration</label>
              <select
                value={settings.slot_duration_minutes}
                onChange={e => setSettings({ ...settings, slot_duration_minutes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Telegram Integration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bot Token</label>
                  <input
                    type="password"
                    value={settings.telegram_bot_token || ""}
                    onChange={e => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chat ID</label>
                  <input
                    type="text"
                    value={settings.telegram_chat_id || ""}
                    onChange={e => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder="e.g. -1001234567890"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Holiday / Blocked Dates</h2>
          </div>
          
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            {editingHoliday ? (
              <form onSubmit={handleUpdateHoliday} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Edit Date</label>
                  <input
                    type="date"
                    required
                    value={editingHoliday.date}
                    onChange={e => setEditingHoliday({ ...editingHoliday, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Edit Description</label>
                  <input
                    type="text"
                    required
                    value={editingHoliday.description}
                    onChange={e => setEditingHoliday({ ...editingHoliday, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingHoliday(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddHoliday} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    value={newHolidayDate}
                    onChange={e => setNewHolidayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. New Year"
                    value={newHolidayDesc}
                    onChange={e => setNewHolidayDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>
            )}
          </div>

          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {holidays.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No holidays configured.
              </div>
            ) : (
              holidays.map(holiday => (
                <div key={holiday.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{format(parseISO(holiday.date), "MMM d, yyyy")}</div>
                    <div className="text-sm text-slate-500">{holiday.description}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingHoliday(holiday)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
