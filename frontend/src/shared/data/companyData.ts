import { Employee, Machine, Site } from '../types/domain';

// Seed data captured from the provided Thandanazi machine/operator attachments.
// Treat this as the starting company master data. Replace or import from CSV before production go-live.
export const COMPANY_NAME = 'Thandanazi Projects Pty Ltd';

export const SITES: Site[] = [
  { siteId: 'ALL', name: 'All Sites' },
  { siteId: 'DEMO-SITE-A', name: 'Buffels' },
  { siteId: 'DEMO-SITE-C', name: 'Harties' },
  { siteId: 'DEMO-SITE-D', name: 'Kareerand' },
  { siteId: 'DEMO-SITE-B', name: '4 & 5 Haarties' },
  { siteId: 'DEMO-SITE-B', name: '4 & 5 / Harties' },
  { siteId: 'DEMO-SITE-E', name: 'DEMO-SITE-E' },
  { siteId: 'PLANT', name: 'Plant' },
  { siteId: 'SUPERVISOR', name: 'Supervisor / Roaming' }
];

export const MACHINES: Machine[] = [
  { machineId: 'THA002', siteId: 'ALL', label: 'THA002 - Tlb - JCB BACKHOE RANGE - LCJ641NW', machineType: 'TLB', regNo: 'LCJ641NW', status: 'ACTIVE' },
  { machineId: 'THA004', siteId: 'ALL', label: 'THA004 - Front End Loader - CAT', machineType: 'FRONT END LOADER', regNo: 'CAT', status: 'ACTIVE' },
  { machineId: 'THA005', siteId: 'ALL', label: 'THA005 - Excavator - HYUNDAI EXCAVATOR R215L - HYUNDAI R215L', machineType: 'EXCAVATOR', regNo: 'HYUNDAI R215L', status: 'ACTIVE' },
  { machineId: 'THA007', siteId: 'ALL', label: 'THA007 - Excavator - HYUNDAI ROBEX 210 HYDRAULIC EXCAVATOR - HYUNDAI 210', machineType: 'EXCAVATOR', regNo: 'HYUNDAI 210', status: 'ACTIVE' },
  { machineId: 'THA008', siteId: 'ALL', label: 'THA008 - Tipper Truck - TIPPER TRUCK-FAW CA SERIES - KYL358NW', machineType: 'TIPPER TRUCK', regNo: 'KYL358NW', status: 'ACTIVE' },
  { machineId: 'THA009', siteId: 'ALL', label: 'THA009 - Tipper Truck - TIPPER TRUCK-FAW CA SERIES - LCJ640NW', machineType: 'TIPPER TRUCK', regNo: 'LCJ640NW', status: 'ACTIVE' },
  { machineId: 'THA014', siteId: 'ALL', label: 'THA014 - ADT - BELL B20E', machineType: 'ADT', regNo: 'BELL B20E', status: 'ACTIVE' },
  { machineId: 'THA016', siteId: 'ALL', label: 'THA016 - ADT - BELL B225D 6 X 6 ARTICULATED DUMP TRUCK - BELL B225D', machineType: 'ADT', regNo: 'BELL B225D', status: 'ACTIVE' },
  { machineId: 'THA017', siteId: 'ALL', label: 'THA017 - Tipper Truck - NISSAN A450 - KXX556NW', machineType: 'TIPPER TRUCK', regNo: 'KXX556NW', status: 'ACTIVE' },
  { machineId: 'THA018', siteId: 'ALL', label: 'THA018 - Excavator - HYUNDAI EXCAVATOR R215L - HYUNDAI R215L', machineType: 'EXCAVATOR', regNo: 'HYUNDAI R215L', status: 'ACTIVE' },
  { machineId: 'THA027', siteId: 'ALL', label: 'THA027 - ADT - BELL B20D', machineType: 'ADT', regNo: 'BELL B20D', status: 'ACTIVE' },
  { machineId: 'THA029', siteId: 'ALL', label: 'THA029 - Dozer - D65', machineType: 'DOZER', regNo: 'D65', status: 'ACTIVE' },
  { machineId: 'THA031', siteId: 'ALL', label: 'THA031 - ADT - BELL B20D', machineType: 'ADT', regNo: 'BELL B20D', status: 'ACTIVE' },
  { machineId: 'THA034', siteId: 'ALL', label: 'THA034 - Water Truck - ISUZU F SERIES - F SERIES', machineType: 'WATER TRUCK', regNo: 'F SERIES', status: 'ACTIVE' },
  { machineId: 'THA035', siteId: 'ALL', label: 'THA035 - Front End Loader - HOLLAND W130B - W130B', machineType: 'FRONT END LOADER', regNo: 'W130B', status: 'ACTIVE' },
  { machineId: 'THA036', siteId: 'ALL', label: 'THA036 - Front End Loader - SDLG L958F - L958F', machineType: 'FRONT END LOADER', regNo: 'L958F', status: 'ACTIVE' },
  { machineId: 'THA037', siteId: 'ALL', label: 'THA037 - Roller - LIUGONG LG614 - LG614', machineType: 'ROLLER', regNo: 'LG614', status: 'ACTIVE' },
  { machineId: 'THA039', siteId: 'ALL', label: 'THA039 - Excavator - CAT 320D', machineType: 'EXCAVATOR', regNo: 'CAT 320D', status: 'ACTIVE' },
  { machineId: 'THA043', siteId: 'ALL', label: 'THA043 - Tlb - SHANDONG LINGONG - LHJ 536NW', machineType: 'TLB', regNo: 'LHJ 536NW', status: 'ACTIVE' },
  { machineId: 'THA042', siteId: 'ALL', label: 'THA042 - Front End Loader - CAT - 950', machineType: 'FRONT END LOADER', regNo: '950', status: 'ACTIVE' },
  { machineId: 'THA044', siteId: 'ALL', label: 'THA044 - Water Truck - MERCEDES-BENZ ATEGO - LFM292NW', machineType: 'WATER TRUCK', regNo: 'LFM292NW', status: 'ACTIVE' },
  { machineId: 'THA045', siteId: 'ALL', label: 'THA045 - Excavator - HYUNDAI ROBEXR20 - ROBEXR20', machineType: 'EXCAVATOR', regNo: 'ROBEXR20', status: 'ACTIVE' },
  { machineId: 'THA046', siteId: 'ALL', label: 'THA046 - Excavator - HYUNDAI ROBEXR20 - ROBEXR20', machineType: 'EXCAVATOR', regNo: 'ROBEXR20', status: 'ACTIVE' },
  { machineId: 'THA047', siteId: 'ALL', label: 'THA047 - Dozer - LUIGONG CLG614', machineType: 'DOZER', regNo: 'LUIGONG CLG614', status: 'ACTIVE' },
  { machineId: 'THA048', siteId: 'ALL', label: 'THA048 - Excavator - CAT 320 D2L - 320 D2L', machineType: 'EXCAVATOR', regNo: '320 D2L', status: 'ACTIVE' },
  { machineId: 'THA049', siteId: 'ALL', label: 'THA049 - Excavator - HYUNDAI HX 220S - HX 220S', machineType: 'EXCAVATOR', regNo: 'HX 220S', status: 'ACTIVE' },
  { machineId: 'THA050', siteId: 'ALL', label: 'THA050 - ADT - BELL B40D - B40D', machineType: 'ADT', regNo: 'B40D', status: 'ACTIVE' },
  { machineId: 'THA051', siteId: 'ALL', label: 'THA051 - Front End Loader - CAT - 950G', machineType: 'FRONT END LOADER', regNo: '950G', status: 'ACTIVE' },
  { machineId: 'THA055', siteId: 'ALL', label: 'THA055 - Tipper Truck - FAW CA SERIES - LJN705NW', machineType: 'TIPPER TRUCK', regNo: 'LJN705NW', status: 'ACTIVE' },
  { machineId: 'THA057', siteId: 'ALL', label: 'THA057 - Excavator - HYUNDAI - R215', machineType: 'EXCAVATOR', regNo: 'R215', status: 'ACTIVE' },
  { machineId: 'THA058', siteId: 'ALL', label: 'THA058 - Grader - LUIGONG - CLG4180D', machineType: 'GRADER', regNo: 'CLG4180D', status: 'ACTIVE' },
  { machineId: 'THA059', siteId: 'ALL', label: 'THA059 - ADT - BELL - B40B', machineType: 'ADT', regNo: 'B40B', status: 'ACTIVE' },
  { machineId: 'THA060', siteId: 'ALL', label: 'THA060 - ADT - BELL - B40B', machineType: 'ADT', regNo: 'B40B', status: 'ACTIVE' },
  { machineId: 'THA061', siteId: 'ALL', label: 'THA061 - ADT - BELL - B40B', machineType: 'ADT', regNo: 'B40B', status: 'ACTIVE' },
  { machineId: 'THA062', siteId: 'ALL', label: 'THA062 - ADT - BELL - B40B', machineType: 'ADT', regNo: 'B40B', status: 'ACTIVE' },
  { machineId: 'THA063', siteId: 'ALL', label: 'THA063 - Front End Loader - CHANGLIN - 957', machineType: 'FRONT END LOADER', regNo: '957', status: 'ACTIVE' },
  { machineId: 'THA064', siteId: 'ALL', label: 'THA064 - Tipper Truck - FAW SERIES - NEW', machineType: 'TIPPER TRUCK', regNo: 'NEW', status: 'ACTIVE' },
  { machineId: '36TLB001', siteId: 'ALL', label: '36TLB001 - Low Bed - 36 TON LOW BED', machineType: 'LOW BED', regNo: '', status: 'ACTIVE' }
];

export const EMPLOYEES: Employee[] = [
  { employeeNumber: 'Z9000003', fullName: 'Demo Worker 01', role: 'worker', siteIds: ['DEMO-SITE-A'], hasPassword: false, permittedMachineTypes: ['GENERAL'], permitExpiry: undefined, medicalExpiry: undefined },
  { employeeNumber: 'Z9000021', fullName: 'Demo Worker 02', role: 'worker', siteIds: ['ALL'], hasPassword: false, permittedMachineTypes: ['DIESEL TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000005', fullName: 'Demo Worker 03', role: 'worker', siteIds: ['DEMO-SITE-A'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000004', fullName: 'Demo Worker 04', role: 'supervisor', siteIds: ['SUPERVISOR'], hasPassword: false, permittedMachineTypes: ['BAKKIE'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000010', fullName: 'Demo Worker 05', role: 'worker', siteIds: ['DEMO-SITE-C'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR', 'TLB', 'GRADER', 'FRONT END LOADER'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000019', fullName: 'Demo Worker 06', role: 'worker', siteIds: ['ALL'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR', 'ADT', 'TLB', 'GRADER'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000028', fullName: 'Demo Worker 07', role: 'worker', siteIds: ['DEMO-SITE-D'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000016', fullName: 'Demo Worker 08', role: 'worker', siteIds: ['DEMO-SITE-B'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR', 'WATER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000015', fullName: 'Demo Worker 09', role: 'worker', siteIds: ['DEMO-SITE-B'], hasPassword: false, permittedMachineTypes: ['ADT', 'TLB', 'ROLLER', 'MECHANIC'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000014', fullName: 'Demo Worker 10', role: 'worker', siteIds: ['DEMO-SITE-D'], hasPassword: false, permittedMachineTypes: ['ADT', 'TIPPER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000002', fullName: 'Demo Worker 11', role: 'worker', siteIds: ['DEMO-SITE-D'], hasPassword: false, permittedMachineTypes: ['TIPPER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000011', fullName: 'Demo Worker 12', role: 'worker', siteIds: ['DEMO-SITE-E'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR', 'ADT', 'WATER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000017', fullName: 'Demo Worker 13', role: 'worker', siteIds: ['DEMO-SITE-B'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000007', fullName: 'Demo Worker 14', role: 'worker', siteIds: ['DEMO-SITE-C'], hasPassword: false, permittedMachineTypes: ['ADT', 'WATER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000001', fullName: 'Demo Worker 15', role: 'worker', siteIds: ['PLANT'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR', 'FRONT END LOADER'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000012', fullName: 'Demo Worker 16', role: 'worker', siteIds: ['DEMO-SITE-B'], hasPassword: false, permittedMachineTypes: ['FRONT END LOADER'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000018', fullName: 'Demo Worker 17', role: 'worker', siteIds: ['DEMO-SITE-D'], hasPassword: false, permittedMachineTypes: ['DOZER'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000020', fullName: 'Demo Worker 18', role: 'worker', siteIds: ['DEMO-SITE-C'], hasPassword: false, permittedMachineTypes: ['FRONT END LOADER', 'ADT'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000023', fullName: 'Demo Worker 19', role: 'worker', siteIds: ['DEMO-SITE-B'], hasPassword: false, permittedMachineTypes: ['TIPPER TRUCK', 'ADT'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000009', fullName: 'Demo Worker 20', role: 'worker', siteIds: ['DEMO-SITE-C'], hasPassword: false, permittedMachineTypes: ['WATER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000008', fullName: 'Demo Worker 21', role: 'worker', siteIds: ['DEMO-SITE-A'], hasPassword: false, permittedMachineTypes: ['ROLLER', 'WATER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000022', fullName: 'Demo Worker 22', role: 'worker', siteIds: ['PLANT'], hasPassword: false, permittedMachineTypes: ['TLB', 'EXCAVATOR', 'FRONT END LOADER', 'ADT'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000025', fullName: 'Demo Worker 23', role: 'worker', siteIds: ['DEMO-SITE-C'], hasPassword: false, permittedMachineTypes: ['ADT', 'FRONT END LOADER', 'TLB', 'DOZER'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000024', fullName: 'Demo Worker 24', role: 'worker', siteIds: ['DEMO-SITE-A'], hasPassword: false, permittedMachineTypes: ['FRONT END LOADER', 'EXCAVATOR', 'TLB'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000026', fullName: 'Demo Worker 25', role: 'worker', siteIds: ['DEMO-SITE-C'], hasPassword: false, permittedMachineTypes: ['EXCAVATOR'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000027', fullName: 'Demo Worker 26', role: 'worker', siteIds: ['DEMO-SITE-A'], hasPassword: false, permittedMachineTypes: ['ADT'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000006', fullName: 'Demo Worker 27', role: 'worker', siteIds: ['DEMO-SITE-B'], hasPassword: false, permittedMachineTypes: ['TIPPER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' },
  { employeeNumber: 'Z9000013', fullName: 'Demo Worker 28', role: 'worker', siteIds: ['PLANT'], hasPassword: false, permittedMachineTypes: ['TIPPER TRUCK'], permitExpiry: '2027-12-31', medicalExpiry: '2027-12-31' }
];

export function findEmployee(employeeNumber: string) {
  return EMPLOYEES.find((employee) => employee.employeeNumber.toUpperCase() === employeeNumber.toUpperCase());
}

export function machineOptionsForSite(siteId: string) {
  // The supplied machine list does not allocate machine numbers to specific sites yet.
  // Until site-machine allocation is confirmed, show the full fleet for every operational site.
  return MACHINES.filter((machine) => machine.siteId === 'ALL' || machine.siteId === siteId);
}

const GENERIC_PRE_USE_CHECKLIST = [
  // Generic machines must still show A/B/C classes. This prevents the old "only one class" checklist problem.
  'Brakes / park brake',
  'Steering operation',
  'Seat and safety belt',
  'Lights and indicators',
  'Fire extinguisher',
  'Engine oil level',
  'Hydraulic oil level',
  'Tyres, wheels and nuts',
  'Machine cleanliness and mirrors'
];

export const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  ADT: [
    'Brakes / park brake', 'Steering operation', 'Lights', 'Tyres, wheels and nuts', 'Suspension',
    'Warning lights and gauges', 'Hooters', 'Engine oil level', 'Engine oil cap', 'Transmission oil level',
    'Transmission oil cap', 'Hydraulic oil level', 'Hydraulic oil cap', 'V-belts', 'Coolant level',
    'Coolant system re-fill cap', 'Diesel fuel cap', 'Seat and safety belt', 'Reverse alarm',
    'Air cleaners and gauge', 'Battery cable connectors', 'Hydraulic cylinder leaks', 'Strobe light',
    'Fire extinguisher', 'Triangles', 'Air leaks', 'Brake test', 'Stop blocks', 'Air conditioner / heater'
  ],
  'FRONT END LOADER': [
    'Brakes / park brake', 'Head/tail lights', 'Coolant system level and re-fill cap',
    'Rear view mirrors clean and undamaged', 'EMS / cluster panel function', 'Hooter',
    'Diesel fuel cap secure', 'Engine oil level and filler cap', 'Transmission oil level',
    'Hydraulic oil level and filler cap', 'Air cleaners and gauge', 'Reverse alarm', 'Strobe lights',
    'Fire extinguisher', 'Seat and safety belt functioning', 'Battery compartment, cable and connectors',
    'Engine oil leaks', 'Steering operation', 'Tyres, wheels and nuts', 'Air conditioner / heater',
    'Isolation facility functional'
  ],
  FEL: [
    'Brakes / park brake', 'Head/tail lights', 'Coolant system level and re-fill cap',
    'Rear view mirrors clean and undamaged', 'EMS / cluster panel function', 'Hooter',
    'Diesel fuel cap secure', 'Engine oil level and filler cap', 'Transmission oil level',
    'Hydraulic oil level and filler cap', 'Air cleaners and gauge', 'Reverse alarm', 'Strobe lights',
    'Fire extinguisher', 'Seat and safety belt functioning', 'Battery compartment, cable and connectors',
    'Engine oil leaks', 'Steering operation', 'Tyres, wheels and nuts', 'Air conditioner / heater',
    'Isolation facility functional'
  ],
  EXCAVATOR: [
    'Steering controls operation', 'Lights', 'Engine coolant level', 'Warning light indicator',
    'Hooter', 'Travel alarm', 'Diesel fuel cap secure', 'Engine oil level and cap',
    'Hydraulic oil level and cap', 'Air cleaner indicator', 'Gauges', 'Seat / safety belt',
    'Strobe light', 'Battery cable and connections', 'Lock-out isolation switch functional',
    'Major hydraulic oil leaks', 'Fire extinguisher available and inspected', 'Air conditioner / heater',
    'Stick general condition', 'Bucket control mechanism', 'Hydraulic cylinders and hoses',
    'Bucket condition, cutting edges and bucket tips', 'Track tension and adjustment', 'Sprocket segments',
    'Undercarriage condition', 'Oil leaks', 'Condition of mirrors', 'Windows and cabin clean', 'Machine cleanliness'
  ],
  DOZER: [
    'Lights all round', 'Seat and safety belt functioning', 'Water leaks', 'Rear view mirrors clean and undamaged',
    'EMS / cluster panel function', 'Diesel fuel cap secure', 'Engine oil level and filler cap',
    'Engine oil leaks', 'Transmission oil level and filler cap', 'Hydraulic oil level and filler cap',
    'Air cleaners and gauge', 'Battery compartment, cable and connectors', 'Strobe light', 'Reverse alarm',
    'Hooter', 'Fire extinguisher', 'Fire suppression system charged', 'Decelerator', 'Air conditioner / heater',
    'Blade / ripper control mechanism', 'Ripper general condition', 'Hydraulic cylinder and hoses',
    'Equalizer bar and pads', 'Blade condition', 'Track adjustment', 'Sprocket and teeth', 'Undercarriage condition'
  ],
  ROLLER: [
    'Seat and safety belt', 'Lights: head, tail, indicators and amber', 'Water leaks',
    'Cluster / information light panel function', 'Instrument gauges operative', 'Diesel fuel cap',
    'Engine oil level and filler cap', 'Transmission oil level and filler cap',
    'Hydraulic oil level and filler cap', 'Steering operation', 'Tyres, wheels and nuts',
    'Air cleaners and gauge', 'Battery and cable connectors', 'Strobe light', 'Hooters',
    'Reverse alarm', 'Fire extinguisher', 'Coolant system level and re-fill cap', 'Stop blocks',
    'V-belts', 'Coolant level', 'Drum hydraulic hoses and cylinders', 'Hydraulic cylinder leaks',
    'Triangles', 'Air conditioner / heater'
  ],
  GRADER: [
    'Brakes / park brake', 'Steering operation', 'Lights', 'Tyres and wheels condition, pressure and nuts',
    'Suspension', 'Instrument panel function', 'Hooter', 'Reverse alarm', 'Engine oil level',
    'Engine oil level cap secured', 'Transmission oil level', 'Hydraulic oil level', 'Hydraulics system oil leaks',
    'Coolant system level', 'Expansion tank condition and cap', 'Diesel fuel cap secured',
    'Seat and safety belt', 'Battery cables and connector clamps', 'Lock-out lock function', 'Strobe light',
    'Fire extinguisher', 'Air conditioner / heater', 'Isolation facility functional',
    'Windscreen clean', 'Rear view mirrors clean', 'Air cleaner and gauge', 'Tandem oil leaks',
    'Cab / windows / door closing', 'A-frame and circle', 'Cutting edges main', 'Scarifier tips condition'
  ],
  TLB: GENERIC_PRE_USE_CHECKLIST,
  'TIPPER TRUCK': GENERIC_PRE_USE_CHECKLIST,
  'WATER TRUCK': GENERIC_PRE_USE_CHECKLIST,
  'DIESEL TRUCK': GENERIC_PRE_USE_CHECKLIST,
  'LOW BED': GENERIC_PRE_USE_CHECKLIST,
  GENERAL: GENERIC_PRE_USE_CHECKLIST
};

const CLASS_A_TERMS = [
  'brake', 'park brake', 'steering', 'seat and safety belt', 'safety belt', 'reverse alarm',
  'travel alarm', 'hooter', 'fire extinguisher', 'fire suppression', 'strobe', 'lock-out',
  'isolation', 'hydraulic cylinder leaks', 'major hydraulic oil leaks', 'air leaks', 'brake test',
  'warning light', 'instrument gauges', 'cluster panel', 'ems', 'lights', 'head/tail lights'
];
const CLASS_C_TERMS = [
  'machine cleanliness', 'windows and cabin clean', 'windscreen clean', 'rear view mirrors clean',
  'air conditioner', 'heater', 'steps', 'triangles', 'diesel fuel dust cover', 'cab / windows / door closing'
];
const CLASS_B_TERMS = [
  'engine oil level', 'transmission oil level', 'hydraulic oil level', 'coolant', 'diesel fuel cap',
  'air cleaner', 'battery', 'v-belts', 'tyres', 'wheels', 'suspension', 'undercarriage', 'track',
  'sprocket', 'bucket', 'cutting edges', 'blade', 'ripper', 'a-frame', 'scarifier', 'mirrors',
  'oil leaks', 'water leaks', 'hydraulic hoses', 'cylinders'
];
function defectClassFor(label: string): 'A'|'B'|'C' {
  const value = label.toLowerCase();
  if (CLASS_C_TERMS.some(term => value.includes(term))) return 'C';
  if (CLASS_A_TERMS.some(term => value.includes(term))) return 'A';
  if (CLASS_B_TERMS.some(term => value.includes(term))) return 'B';
  return 'B';
}
export function checklistForMachineType(machineType?: string) {
  const key = (machineType || 'GENERAL').toUpperCase();
  const labels = CHECKLIST_TEMPLATES[key] || CHECKLIST_TEMPLATES.GENERAL;
  return labels.map((label, index) => ({ id: `${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`, label, required: true, defectClass: defectClassFor(label) }));
}
