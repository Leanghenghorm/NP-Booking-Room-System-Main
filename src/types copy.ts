export type Room = {
  id: number;
  name: string;
  location: string;
  capacity: number;
  status: "active" | "maintenance";
};

export type Booking = {
  id: number;
  room_id: number;
  user_id: number;
  department_id: number;
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  status: "confirmed" | "cancelled" | "completed";
  refreshment_request?: number;
  participant_count?: number;
  user_name: string;
  department_name: string;
  room_name: string;
};

export type User = {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "user";
  department_id: number;
  department_name: string;
  status: "active" | "inactive";
};
