export type Role = 'worker' | 'supervisor' | 'admin' | 'mechanic';
export type ShiftStatus = 'ACTIVE' | 'COMPLETED' | 'PENDING_SYNC';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type OpsStatus = 'Open' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Closed';
export type ChecklistDecision = 'GO' | 'NO_GO';
export type DefectClass = 'A' | 'B' | 'C';
export interface GpsPoint { lat: number; lng: number; accuracy?: number; unavailable?: boolean; error?: string; }
export interface Employee { employeeNumber: string; fullName: string; role: Role; email?: string; siteIds?: string[]; hasPassword?: boolean; medicalExpiry?: string; permitExpiry?: string; permittedMachineTypes?: string[]; status?: 'ACTIVE'|'INACTIVE'; }
export interface Site { siteId: string; name: string; status?: 'ACTIVE'|'INACTIVE'; }
export interface Machine { machineId: string; siteId: string; label: string; machineType?: string; regNo?: string; status?: 'ACTIVE'|'INACTIVE'|'OUT_OF_SERVICE'; }
export interface ChecklistItem { id: string; label: string; required: boolean; decision?: ChecklistDecision; defectClass: DefectClass; remarks?: string; reportSubmitted?: boolean; }
export interface ChecklistTemplate { templateId:string; machineType:string; name:string; status:'ACTIVE'|'INACTIVE'; items:Array<Pick<ChecklistItem,'id'|'label'|'required'|'defectClass'>>; }
export interface EmergencyContact { contactId:string; name:string; phone:string; email?:string; role:string; active:boolean; }
export interface AuditRecord { actor:string; action:string; target:string; details?:Record<string,unknown>; createdAt:string; }
export interface ShiftRecord { shiftId: string; employeeNumber: string; fullName?: string; siteId: string; machineId: string; status: ShiftStatus; checklist: ChecklistItem[]; checklistReportId?: string; startMeterReading?: number; startMeterPhoto: string; closingMeterReading?: number; closingMeterPhoto?: string; gpsStart: GpsPoint; gpsEnd?: GpsPoint; clockInTime: string; clockOutTime?: string; totalHours?: number;
  shiftType?: 'DAY' | 'NIGHT';
  nightShift?: boolean;
  nightHours?: number;
  dayHours?: number;
  payrollDate?: string;
  shiftWindowLabel?: string; synced?: boolean; }
export interface FuelRequest { requestId: string; employeeNumber: string; machineId: string; fuelLevel: number; requestedLitres?: number; distributedLitres?: number; distributionPhotos?: string[]; gps?: GpsPoint; timestamp: string; status: OpsStatus; assignedFuelWorker?: string; assignedFuelWorkerName?: string; fuelBalanceAfter?: number; }
export interface BreakdownReport { breakdownId: string; employeeNumber: string; machineId: string; severity: Exclude<Severity, 'Critical'>; description: string; photos: string[]; gps?: GpsPoint; timestamp: string; status: OpsStatus; }
export interface EmergencyReport { emergencyId: string; employeeNumber: string; type: 'Injury' | 'Fire' | 'Gas' | 'Collapse' | 'Other'; severity: Severity; notes?: string; gps: GpsPoint; timestamp: string; status: OpsStatus; }
export interface AdhocTask { taskId: string; title: string; description: string; priority: 'Normal' | 'Urgent'; assignedTo: string[]; assignedBy: string; dueDate?: string; createdAt: string; status: 'Unread' | 'Read' | 'Complete' | 'Completed'; sourceEntity?: 'FUEL' | 'BREAKDOWN' | 'CHECKLIST_REPORT' | 'EMERGENCY'; sourceId?: string; }
export interface WebSocketEnvelope<T = unknown> { type: 'TASK_ASSIGNED'|'EMERGENCY_CREATED'|'FUEL_REQUEST_CREATED'|'BREAKDOWN_CREATED'|'SHIFT_STARTED'|'SHIFT_ENDED'|'CERTIFICATE_UPDATED'|'CHECKLIST_DEFECT_REPORTED'|'FUEL_REQUEST_ASSIGNED'|'FUEL_STOCK_UPDATED'|'FUEL_REQUEST_RESOLVED'|'MECHANIC_STATUS_UPDATED'; payload: T; }
