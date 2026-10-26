export type Role = 'worker' | 'supervisor' | 'admin' | 'mechanic';
export type ShiftStatus = 'ACTIVE' | 'COMPLETED' | 'PENDING_SYNC';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type OpsStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  unavailable?: boolean;
  error?: string;
}

export interface Employee {
  employeeNumber: string;
  fullName: string;
  role: Role;
  siteIds?: string[];
  hasPassword: boolean;
  medicalExpiry?: string;
  permitExpiry?: string;
}

export interface Site { siteId: string; name: string; }
export interface Machine { machineId: string; siteId: string; label: string; }
export interface ChecklistItem { id: string; label: string; required: boolean; checked?: boolean; }

export interface ShiftRecord {
  shiftId: string;
  employeeNumber: string;
  fullName?: string;
  siteId: string;
  machineId: string;
  status: ShiftStatus;
  checklist: ChecklistItem[];
  startMeterReading?: number; startMeterPhoto: string;
  closingMeterReading?: number; closingMeterPhoto?: string;
  gpsStart: GpsPoint;
  gpsEnd?: GpsPoint;
  clockInTime: string;
  clockOutTime?: string;
  totalHours?: number;
  shiftType?: 'DAY' | 'NIGHT';
  nightShift?: boolean;
  nightHours?: number;
  dayHours?: number;
  payrollDate?: string;
  shiftWindowLabel?: string;
  synced?: boolean;
}

export interface FuelRequest {
  requestId: string;
  employeeNumber: string;
  machineId: string;
  fuelLevel: number;
  gps?: GpsPoint;
  timestamp: string;
  status: OpsStatus;
}

export interface BreakdownReport {
  breakdownId: string;
  employeeNumber: string;
  machineId: string;
  severity: Exclude<Severity, 'Critical'>;
  description: string;
  photos: string[];
  gps?: GpsPoint;
  timestamp: string;
  status: OpsStatus;
}

export interface EmergencyReport {
  emergencyId: string;
  employeeNumber: string;
  type: 'Injury' | 'Fire' | 'Gas' | 'Collapse' | 'Other';
  severity: Severity;
  notes?: string;
  gps: GpsPoint;
  timestamp: string;
  status: OpsStatus;
}

export interface AdhocTask {
  taskId: string;
  title: string;
  description: string;
  priority: 'Normal' | 'Urgent';
  assignedTo: string[];
  assignedBy: string;
  dueDate?: string;
  createdAt: string;
  status: 'Unread' | 'Read' | 'Complete';
}

export interface WebSocketEnvelope<T = unknown> {
  type:
    | 'TASK_ASSIGNED'
    | 'EMERGENCY_CREATED'
    | 'FUEL_REQUEST_CREATED'
    | 'BREAKDOWN_CREATED'
    | 'SHIFT_STARTED'
    | 'SHIFT_ENDED'
    | 'CERTIFICATE_UPDATED'
    | 'CHECKLIST_DEFECT_REPORTED'
    | 'FUEL_REQUEST_ASSIGNED'
    | 'FUEL_REQUEST_RESOLVED'
    | 'FUEL_STOCK_UPDATED';
  payload: T;
}
