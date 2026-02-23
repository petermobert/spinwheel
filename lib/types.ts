export type FilterMode = "ALL" | "ELIGIBLE" | "USED" | "WINNERS";

export type LeadRow = {
  id: string;
  wheel_id: string;
  first_name: string;
  last_name: string;
  street: string | null;
  city: string | null;
  zip_code: string;
  phone_number: string;
  email_address: string;
  follow_up_requested: boolean;
  created_at: string;
  source: string;
  status: string;
  wheel_entry_id: string | null;
  used: boolean;
  used_timestamp: string | null;
  winner: boolean;
  winner_timestamp: string | null;
  spin_id: string | null;
  wheel_entries?: { display_name: string } | null;
};

export type WheelRow = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  is_active: boolean;
};

export type WheelSnapshotEntry = {
  wheel_entry_id: string;
  display_name: string;
  lead_id: string;
};

export type SpinCreateResponse = {
  spinId: string;
  winnerWheelEntryId: string;
  winnerDisplayName: string;
  winnerIndex: number;
  entriesSnapshot: WheelSnapshotEntry[];
};
