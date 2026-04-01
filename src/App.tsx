import { useState } from "react";
import { AuthProvider } from "./components/AuthProvider";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { MyBookings } from "./components/MyBookings";
import { CalendarView } from "./components/CalendarView";
import { TimeManagement } from "./components/TimeManagement";
import { UserManagement } from "./components/UserManagement";

export default function App() {
  const [currentTab, setCurrentTab] = useState("dashboard");

  return (
    <AuthProvider>
      <Layout currentTab={currentTab} onTabChange={setCurrentTab}>
        {currentTab === "dashboard" && <Dashboard onTabChange={setCurrentTab} />}
        {currentTab === "calendar" && <CalendarView />}
        {currentTab === "my-bookings" && <MyBookings />}
        {currentTab === "time-management" && <TimeManagement />}
        {currentTab === "user-management" && <UserManagement />}
      </Layout>
    </AuthProvider>
  );
}
