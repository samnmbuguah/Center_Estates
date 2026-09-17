"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from "@mui/material";
import {
  Plus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit,
  FileText,
  Check,
  X,
  Scale,
  Wand2,
  Layers,
  HelpCircle,
  ClipboardCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Row } from "../../types/facility.types";

interface RubricItem {
  id?: string;
  order: number;
  area: string;
  measure: string;
  target_standard: string;
  evidence_method: string;
  max_weight: number;
  is_active?: boolean;
}

interface RubricTemplate {
  key: string;
  name: string;
  code: string;
  appraisal_frequency: string;
  scope: string;
  sla_standard: string;
  kpis: RubricItem[];
}

interface ServiceLinesViewProps {
  organizationId: string | null;
  canAdminister?: boolean;
}

// Built-in starter fallback templates
const CLIENT_TEMPLATES: Record<string, RubricTemplate> = {
  cleaning: {
    key: "cleaning",
    name: "Cleaning & Housekeeping",
    code: "SL-CLEAN",
    appraisal_frequency: "monthly",
    scope: "Internal office, common area, basements, washrooms cleaning, sanitization and waste collection.",
    sla_standard: "Daily cleaning commenced by 6:00 AM, continuous washroom maintenance, twice-weekly floor polishing.",
    kpis: [
      { order: 1, area: "Timing", measure: "Timing for commencement of cleaning activities within building.", target_standard: "Commence by 6:00 AM daily", evidence_method: "Arrival logs / guard register", max_weight: 5 },
      { order: 2, area: "Offices & Dusting", measure: "Cleaning and dusting of desk, chairs and filing cabinets in authorized locations.", target_standard: "All workstations dusted daily", evidence_method: "Inspection checklist", max_weight: 10 },
      { order: 3, area: "Fixtures & Glass", measure: "Ability to clean window panes, doors, staircase handrails, balustrades and lifts.", target_standard: "Spotless glass and rails", evidence_method: "Daily inspection", max_weight: 10 },
      { order: 4, area: "Sanitization", measure: "Cleaning and disinfecting washrooms.", target_standard: "Disinfected every 2 hours", evidence_method: "Washroom log sheet", max_weight: 10 },
      { order: 5, area: "Basements", measure: "Washing and maintaining high cleanliness level of basement levels.", target_standard: "Scrubbed and washed weekly", evidence_method: "Basement walkthrough", max_weight: 5 },
      { order: 6, area: "Floors", measure: "Proper scrubbing of floors and polishing of wooden floors twice a week, where applicable.", target_standard: "Polished twice weekly", evidence_method: "Floor inspection", max_weight: 10 },
      { order: 7, area: "Urinal Care", measure: "Ability to supply and distribute quality tissues weekly and mothballs in urinals.", target_standard: "Weekly restocking guaranteed", evidence_method: "Stock issues / checks", max_weight: 5 },
      { order: 8, area: "Hand Towels", measure: "Ability to supply quality hand paper tissues in toilets and office dispensers.", target_standard: "Dispensers never empty", evidence_method: "Dispenser audits", max_weight: 5 },
      { order: 9, area: "Hygiene Soap", measure: "Supply of handwash soap/cream and handwash tissue in all washrooms.", target_standard: "Continuous soap availability", evidence_method: "Daily check", max_weight: 5 },
      { order: 10, area: "Sanitary Services", measure: "Ensuring sanitary bins are supplied and maintained in all ladies washrooms.", target_standard: "Bi-weekly clearance & sanitization", evidence_method: "Service sheets", max_weight: 5 },
      { order: 11, area: "Waste Management", measure: "Timely garbage collection and cleaning of the garbage rooms.", target_standard: "Collected daily, bin room deodorized", evidence_method: "Collection records", max_weight: 10 },
      { order: 12, area: "Fumigation", measure: "Thorough fumigation of offices and common areas.", target_standard: "Monthly / quarterly fumigation certificate", evidence_method: "Fumigation report", max_weight: 5 },
      { order: 13, area: "Staffing Levels", measure: "Ensuring minimum number of cleaners is maintained at all times.", target_standard: "100% attendance per contract headcount", evidence_method: "Attendance register", max_weight: 10 },
      { order: 14, area: "Landscaping / Plants", measure: "Tending and pruning of plants and flowers within common areas where applicable.", target_standard: "Healthy, watered and pruned plants", evidence_method: "Visual check", max_weight: 5 },
    ],
  },
  security: {
    key: "security",
    name: "Guarding & Physical Security",
    code: "SL-SEC",
    appraisal_frequency: "monthly",
    scope: "Physical access control, perimeter security, visitor screening, CCTV monitoring and emergency incident response.",
    sla_standard: "24/7 post coverage, zero unmanned posts, 100% visitor logging, < 3 min emergency response.",
    kpis: [
      { order: 1, area: "Service Quality & Delivery", measure: "Quality against contract SLA and post vigilance.", target_standard: "Zero unmanned posts", evidence_method: "Shift checks / supervisor logs", max_weight: 15 },
      { order: 2, area: "Responsiveness & TAT", measure: "Response to security incidents and emergency alerts.", target_standard: "< 3 min emergency response", evidence_method: "Occurrence book / alert logs", max_weight: 10 },
      { order: 3, area: "Reliability & Availability", measure: "Continuity of security operations and guard relief.", target_standard: "100% shift coverage", evidence_method: "Daily attendance register", max_weight: 10 },
      { order: 4, area: "Compliance & Contract", measure: "Statutory compliance (PSRA license, guard vetting, certificates).", target_standard: "100% licensed & vetted", evidence_method: "Compliance audit records", max_weight: 10 },
      { order: 5, area: "HSE & Safety", measure: "Safe working practices, PPE and patrol safety.", target_standard: "Zero safety breaches", evidence_method: "Safety audit records", max_weight: 10 },
      { order: 6, area: "Customer Satisfaction", measure: "Tenant and visitor feedback regarding guard courtesy and professionalism.", target_standard: ">= 90% positive ratings", evidence_method: "Feedback tickets / surveys", max_weight: 10 },
      { order: 7, area: "Access Control & VMS", measure: "Visitor management compliance and vehicle search procedures.", target_standard: "100% visitors screened & logged", evidence_method: "VMS electronic records", max_weight: 10 },
      { order: 8, area: "Staffing & Competence", measure: "Adequacy, uniform presentation, competence and sobriety.", target_standard: "Spotless uniform and alert guards", evidence_method: "Shift parade inspections", max_weight: 5 },
      { order: 9, area: "Reporting", measure: "Daily occurrence reports submitted accurately and on time.", target_standard: "Submitted daily by 7:00 AM", evidence_method: "Daily incident reports", max_weight: 5 },
      { order: 10, area: "Cost & Value", measure: "Uptime and care of security equipment (metal detectors, boom barriers).", target_standard: "100% equipment uptime", evidence_method: "Equipment log review", max_weight: 5 },
      { order: 11, area: "Asset Care / PM", measure: "Daily physical check of security gates, locks, torches and radios.", target_standard: "Daily equipment check sheet", evidence_method: "Equipment check sheets", max_weight: 5 },
      { order: 12, area: "Improvement", measure: "Closure of corrective actions and lapse investigations.", target_standard: "Closed within 48 hours", evidence_method: "Corrective action tracker", max_weight: 5 },
    ],
  },
  lift: {
    key: "lift",
    name: "Lift & Escalator Maintenance",
    code: "SL-LIFT",
    appraisal_frequency: "quarterly",
    scope: "Passenger and service lift monthly comprehensive preventive maintenance, breakdown repairs, and statutory safety inspections.",
    sla_standard: ">= 99.5% uptime availability, < 30 min passenger entrapment rescue response, annual OSHA certification.",
    kpis: [
      { order: 1, area: "Availability & Uptime", measure: "Lift operational availability across business hours.", target_standard: ">= 99.5% operational uptime", evidence_method: "Lift controller logs / BMS", max_weight: 20 },
      { order: 2, area: "Entrapment Rescue TAT", measure: "Response time for passenger entrapment emergency calls.", target_standard: "< 30 minutes arrival on site", evidence_method: "Security logs / callout tickets", max_weight: 15 },
      { order: 3, area: "Routine Breakdown TAT", measure: "Response time to non-emergency lift failure calls.", target_standard: "< 1 hour arrival on site", evidence_method: "Service callout tickets", max_weight: 10 },
      { order: 4, area: "Preventive Maintenance", measure: "Execution of scheduled monthly comprehensive servicing.", target_standard: "100% servicing completed", evidence_method: "Job cards & signed service sheets", max_weight: 10 },
      { order: 5, area: "Statutory Safety Inspection", measure: "Annual DOSHS/OSHA examination and operating certification.", target_standard: "Valid statutory certificate", evidence_method: "DOSHS inspection certificates", max_weight: 10 },
      { order: 6, area: "Ride Quality & Leveling", measure: "Smooth acceleration/deceleration and floor leveling precision.", target_standard: "Leveling within +/- 5mm", evidence_method: "Technical audit report", max_weight: 10 },
      { order: 7, area: "Emergency Systems", measure: "Functional check of cabin emergency bell, 2-way intercom and emergency lights.", target_standard: "100% emergency systems functional", evidence_method: "Monthly test log", max_weight: 10 },
      { order: 8, area: "Spares & Consumables", measure: "Availability of critical fast-moving spares (rollers, fuses, contactors).", target_standard: "Zero prolonged spares delays", evidence_method: "Stock records / requisition logs", max_weight: 5 },
      { order: 9, area: "Technician Competence", measure: "Qualified and certified lift technicians with proper PPE and safety gear.", target_standard: "EPRA/NCA certified staff", evidence_method: "Technician certification files", max_weight: 5 },
      { order: 10, area: "Machine Room Housekeeping", measure: "Machine room cleanliness, safety signage, and up-to-date logbook.", target_standard: "Clean, locked, updated logbook", evidence_method: "Machine room audit checklist", max_weight: 5 },
    ],
  },
  generator: {
    key: "generator",
    name: "Backup Generator & Power Systems",
    code: "SL-GEN",
    appraisal_frequency: "quarterly",
    scope: "Standby diesel generator maintenance, AMF switchgear, bulk fuel management and routine testing.",
    sla_standard: "Automatic mains failure transfer < 15s, fuel tank >= 75%, weekly run tests without failure.",
    kpis: [
      { order: 1, area: "AMF Auto-Start Reliability", measure: "Generator auto-start and power transfer upon utility outage.", target_standard: "Power restored < 15 seconds", evidence_method: "AMF panel event logs", max_weight: 20 },
      { order: 2, area: "Fuel Quality & Management", measure: "Fuel level maintained above threshold and free from water/contaminants.", target_standard: "Fuel level >= 75% capacity", evidence_method: "Fuel dip logs & fuel audits", max_weight: 15 },
      { order: 3, area: "Emergency Breakdown TAT", measure: "Arrival time for technician in event of generator failure during power outage.", target_standard: "< 2 hours response time", evidence_method: "Helpdesk dispatch timestamps", max_weight: 10 },
      { order: 4, area: "Preventive Maintenance", measure: "Execution of scheduled oil, filter, coolant and belt changes.", target_standard: "100% servicing per run hours/calendar", evidence_method: "Service sheets & invoices", max_weight: 10 },
      { order: 5, area: "Weekly Run Testing", measure: "Weekly no-load and on-load testing of standby sets.", target_standard: "Weekly test executed without error", evidence_method: "Weekly generator run log", max_weight: 10 },
      { order: 6, area: "Battery Health & Charger", measure: "Starter battery electrolyte, terminal tightness and automatic charger operation.", target_standard: "Battery health 100%, charge active", evidence_method: "Monthly battery test records", max_weight: 10 },
      { order: 7, area: "Safety Trips & Controls", measure: "Operational testing of high temp, low oil pressure and overspeed trip switches.", target_standard: "All safety trips verified", evidence_method: "Trip test inspection sheet", max_weight: 10 },
      { order: 8, area: "Statutory & Emissions", measure: "Compliance with NEMA environmental noise and exhaust emission standards.", target_standard: "Zero pollution complaints", evidence_method: "NEMA compliance report", max_weight: 5 },
      { order: 9, area: "Housekeeping & Bunding", measure: "Generator room cleanliness, oil bund integrity and fire extinguisher readiness.", target_standard: "Spotless room, zero oil leaks", evidence_method: "Monthly site walk walkthrough", max_weight: 5 },
      { order: 10, area: "Documentation & Logs", measure: "Comprehensive recording of run hours, diesel consumption and kilowatt-hours.", target_standard: "Up-to-date accurate logbook", evidence_method: "Generator logbook review", max_weight: 5 },
    ],
  },
  hvac: {
    key: "hvac",
    name: "HVAC & Air Conditioning Systems",
    code: "SL-HVAC",
    appraisal_frequency: "quarterly",
    scope: "Chillers, VRF systems, split units, ventilation fans and air handling units preventive maintenance and repair.",
    sla_standard: ">= 98% uptime in business hours, server room 20-22°C, comfort cooling 21-24°C, < 2hr response for server rooms.",
    kpis: [
      { order: 1, area: "Cooling Uptime & Reliability", measure: "Operational uptime of main chillers, VRF and split systems.", target_standard: ">= 98% availability", evidence_method: "BMS logs & temperature records", max_weight: 15 },
      { order: 2, area: "Environmental Temperature", measure: "Tenant office spaces maintained in optimal comfort temperature range.", target_standard: "21°C - 24°C maintained", evidence_method: "Spot temperature sensor audits", max_weight: 15 },
      { order: 3, area: "Preventive Servicing", measure: "Monthly filter cleaning, chemical coil washing and fan lubrication.", target_standard: "100% servicing completed", evidence_method: "PM service sheets & job cards", max_weight: 15 },
      { order: 4, area: "Emergency Response TAT", measure: "Response time to critical cooling failures (server room, executive suites).", target_standard: "< 2 hours response time", evidence_method: "Helpdesk tickets & logs", max_weight: 10 },
      { order: 5, area: "Refrigerant & Leak Checks", measure: "Gas pressure verification and leak detection on refrigerant piping.", target_standard: "Zero refrigerant leaks", evidence_method: "Pressure test certificates", max_weight: 10 },
      { order: 6, area: "Condensate Drain Management", measure: "Cleaning and treating drain pans to prevent overflows and biological growth.", target_standard: "Zero ceiling water leaks", evidence_method: "Drain inspection checklist", max_weight: 10 },
      { order: 7, area: "BMS & Controls Calibration", measure: "Thermostats, actuator valves and control sensors calibrated.", target_standard: "Accurate sensor readings", evidence_method: "Sensor calibration logs", max_weight: 10 },
      { order: 8, area: "Statutory Compliance", measure: "Compliance with environmental refrigerant handling (F-Gas regulations).", target_standard: "Certified technicians & logs", evidence_method: "Refrigerant logbook & licenses", max_weight: 5 },
      { order: 9, area: "Consumables & Spares", measure: "Availability of replacement filters, capacitors, contactors and belts.", target_standard: "Spares available on demand", evidence_method: "Inventory store records", max_weight: 5 },
      { order: 10, area: "Technical Reporting", measure: "Quarterly comprehensive condition and energy consumption assessment.", target_standard: "Submitted within 5 days of quarter", evidence_method: "Quarterly HVAC engineering report", max_weight: 5 },
    ],
  },
  fire_safety: {
    key: "fire_safety",
    name: "Fire Safety & Firefighting Equipment",
    code: "SL-FIRE",
    appraisal_frequency: "semi_annual",
    scope: "Fire alarm systems, smoke detectors, portable extinguishers, hose reels, hydrants, booster pumps and suppression systems.",
    sla_standard: "100% equipment inspected & tagged, annual county fire certificate, zero panel trouble alerts, < 24h defect resolution.",
    kpis: [
      { order: 1, area: "Extinguishers & Hose Reels", measure: "Inspection, hydrostatic pressure testing and annual tagging of extinguishers.", target_standard: "100% extinguishers tagged & valid", evidence_method: "Extinguisher audit register", max_weight: 15 },
      { order: 2, area: "Fire Alarm Panel Integrity", measure: "Central fire alarm control panel health and zone integrity.", target_standard: "Zero persistent faults or trouble alerts", evidence_method: "Daily panel inspection logs", max_weight: 15 },
      { order: 3, area: "Smoke & Heat Detectors", measure: "Quarterly zone testing and sensitivity checks of smoke and heat sensors.", target_standard: "100% sensors verified operational", evidence_method: "Quarterly sensor test log", max_weight: 10 },
      { order: 4, area: "Fire Pumps & Hydrants", measure: "Booster and jockey pump auto-start on pressure drop, hydrants operational.", target_standard: "Weekly pump test verified", evidence_method: "Pump pressure test logbook", max_weight: 10 },
      { order: 5, area: "Statutory Fire Certification", measure: "Facilitation and receipt of statutory county government fire safety certificate.", target_standard: "Valid county fire certificate", evidence_method: "County fire certificate file", max_weight: 15 },
      { order: 6, area: "Exit Signage & Escape Paths", measure: "Illumination of emergency exit signs and unobstructed escape pathways.", target_standard: "100% exit routes illuminated & clear", evidence_method: "Safety audit checklist", max_weight: 10 },
      { order: 7, area: "Emergency Lighting Testing", measure: "Periodic 3-hour battery discharge test of emergency lighting units.", target_standard: "All emergency lights pass duration test", evidence_method: "Battery discharge test sheets", max_weight: 10 },
      { order: 8, area: "Gas Suppression Systems", measure: "Server room FM200/Novec cylinder pressure, actuator and abort switch checks.", target_standard: "Cylinder pressure within green zone", evidence_method: "Suppression system checklist", max_weight: 5 },
      { order: 9, area: "Drills & Training Support", measure: "Assistance with mandatory annual tenant fire evacuation drills and warden training.", target_standard: "Annual drill executed and documented", evidence_method: "Fire drill evaluation report", max_weight: 5 },
      { order: 10, area: "Defect Rectification TAT", measure: "Rectification speed for identified fire safety faults or discharged units.", target_standard: "< 24 hours resolution time", evidence_method: "Corrective maintenance tickets", max_weight: 5 },
    ],
  },
  pest_control: {
    key: "pest_control",
    name: "Pest Control & Fumigation Services",
    code: "SL-PEST",
    appraisal_frequency: "quarterly",
    scope: "Rodent management, insect eradication, office and common area fumigation, and drain sanitization.",
    sla_standard: "Zero pest infestation, quarterly treatments completed, eco-friendly PCPB registered chemicals, < 12h outbreak response.",
    kpis: [
      { order: 1, area: "Infestation Control", measure: "Efficacy in eliminating pests (cockroaches, bedbugs, rodents, termites).", target_standard: "Zero active pest sightings", evidence_method: "Tenant feedback & inspection report", max_weight: 20 },
      { order: 2, area: "Scheduled Fumigation", measure: "Execution of scheduled quarterly fumigation across common areas and tenancies.", target_standard: "100% scheduled sessions executed", evidence_method: "Signed treatment sheets", max_weight: 15 },
      { order: 3, area: "Safe Chemical Usage", measure: "Use of safe, eco-friendly chemicals approved by the Pest Control Products Board.", target_standard: "100% PCPB approved chemicals", evidence_method: "PCPB chemical approval manifests", max_weight: 15 },
      { order: 4, area: "Rodent Bait Stations", measure: "Inspection, cleaning, and replenishment of secured outdoor and basement bait stations.", target_standard: "Bait stations mapped and intact", evidence_method: "Bait station audit map & log", max_weight: 15 },
      { order: 5, area: "Outbreak Response TAT", measure: "Response time for reported spot pest outbreaks or emergency calls.", target_standard: "< 12 hours response time", evidence_method: "Incident response tickets", max_weight: 10 },
      { order: 6, area: "MSDS & Warning Signage", measure: "Placement of warning notices prior to fumigation and availability of MSDS sheets.", target_standard: "Warning signs placed 24hr prior", evidence_method: "Advance notification logs", max_weight: 10 },
      { order: 7, area: "Safe Waste Disposal", measure: "Environmentally responsible disposal of empty chemical containers and dead rodents.", target_standard: "Zero toxic residue or unsafe disposal", evidence_method: "Disposal tracking slips", max_weight: 10 },
      { order: 8, area: "Clearance Certificates", measure: "Submission of signed certificate of fumigation and chemical application log.", target_standard: "Issued within 24hr of treatment", evidence_method: "Fumigation certificates", max_weight: 5 },
    ],
  },
  landscaping: {
    key: "landscaping",
    name: "Landscaping & Grounds Maintenance",
    code: "SL-LAND",
    appraisal_frequency: "monthly",
    scope: "Lawn care, shrubbery pruning, flower bed cultivation, pathway sweeping, irrigation, and external grounds aesthetics.",
    sla_standard: "Lawn mowed bi-weekly, hedges pruned, daily litter-free grounds, zero dead plants unreplaced.",
    kpis: [
      { order: 1, area: "Lawn Care & Edging", measure: "Mowing, edging, and weeding of grass lawns across premises.", target_standard: "Uniform height, edged bi-weekly", evidence_method: "Weekly grounds checklist", max_weight: 20 },
      { order: 2, area: "Pruning & Tree Trimming", measure: "Trimming of hedges, shaping of shrubs, and pruning branches for sightline safety.", target_standard: "Hedges neatly shaped, trees safe", evidence_method: "Photographic inspection", max_weight: 15 },
      { order: 3, area: "Flowerbeds & Soil Care", measure: "Weeding, mulching, and fertilizing of garden flowerbeds and planters.", target_standard: "Flowerbeds weed-free and healthy", evidence_method: "Monthly garden audit", max_weight: 15 },
      { order: 4, area: "Irrigation & Watering", measure: "Adherence to watering schedules and maintenance of drip/sprinkler lines.", target_standard: "Watered daily before 9 AM / 5 PM", evidence_method: "Watering logbook", max_weight: 15 },
      { order: 5, area: "Pathways & Litter Control", measure: "Sweeping of driveways, parking bays, and pathways free of leaves and litter.", target_standard: "Pavements swept clean daily", evidence_method: "Daily morning walkthrough", max_weight: 15 },
      { order: 6, area: "Plant Replacement", measure: "Prompt replacement of withered, diseased, or dead plants with healthy nursery stock.", target_standard: "Replaced within 7 days", evidence_method: "Planting register & photos", max_weight: 10 },
      { order: 7, area: "Garden Waste Disposal", measure: "Clearing of clippings, pruned branches, and organic waste from public areas.", target_standard: "Cleared on same day of trimming", evidence_method: "Disposal register", max_weight: 5 },
      { order: 8, area: "Safety & Equipment PPE", measure: "Gardener safety gear (goggles, ear protection, boots) and equipment upkeep.", target_standard: "100% PPE compliance", evidence_method: "Safety check inspection", max_weight: 5 },
    ],
  },
  plumbing: {
    key: "plumbing",
    name: "Plumbing & Water Supply Systems",
    code: "SL-PLUMB",
    appraisal_frequency: "monthly",
    scope: "Potable water booster pumps, storage tanks, drainage, sanitary fixtures, rainwater harvesting, and sewer line maintenance.",
    sla_standard: "Zero water outages, < 1hr leak response, bi-annual water tank cleaning, weekly pump pressure verification.",
    kpis: [
      { order: 1, area: "Water Supply & Pump Availability", measure: "Continuous water pressure and operational availability of booster pumps.", target_standard: "Zero water supply interruptions", evidence_method: "Water pump run logs", max_weight: 20 },
      { order: 2, area: "Leak Response TAT", measure: "Response time for pipe bursts, leaking valves, or running cisterns.", target_standard: "< 1 hour response time", evidence_method: "Maintenance incident tickets", max_weight: 20 },
      { order: 3, area: "Tank Cleaning & Chlorination", measure: "Semi-annual deep cleaning, desilting, and chlorination of underground & roof tanks.", target_standard: "Executed every 6 months", evidence_method: "Tank cleaning certificates", max_weight: 15 },
      { order: 4, area: "Drainage & Manhole Clearance", measure: "Preventive rodding and flushing of sewer manholes, storm drains, and grease traps.", target_standard: "Zero manhole or drain blockages", evidence_method: "Drainage inspection sheets", max_weight: 15 },
      { order: 5, area: "Pump Servicing & Float Switches", measure: "Preventive maintenance of pressure tanks, non-return valves, and level sensors.", target_standard: "Monthly preventive check completed", evidence_method: "Plumbing service job cards", max_weight: 10 },
      { order: 6, area: "Water Quality Testing", measure: "Submission of accredited laboratory microbiological and chemical water test report.", target_standard: "Compliant with potable standards", evidence_method: "Lab test certificates", max_weight: 10 },
      { order: 7, area: "Metering & Leak Audits", measure: "Accuracy check of bulk water meters and sub-meter reconciliation to detect losses.", target_standard: "Reconciliation variance < 5%", evidence_method: "Monthly water meter reconciliation", max_weight: 5 },
      { order: 8, area: "Workmanship & Spare Parts", measure: "Quality of piping repairs (proper jointing, brackets, pressure-rated fittings).", target_standard: "Zero rework required", evidence_method: "Quality inspection audits", max_weight: 5 },
    ],
  },
  electrical: {
    key: "electrical",
    name: "Electrical & Lighting Systems",
    code: "SL-ELEC",
    appraisal_frequency: "monthly",
    scope: "Distribution boards, common area lighting, circuit breakers, lightning arrestors, and power factor correction.",
    sla_standard: "100% common area lighting functional, < 1hr outage response, thermal scanning, statutory EPRA compliance.",
    kpis: [
      { order: 1, area: "Lighting Availability", measure: "Functional lighting across corridors, stairwells, basements, and perimeter security.", target_standard: "100% lighting fixtures operational", evidence_method: "Night walkthrough inspection", max_weight: 20 },
      { order: 2, area: "Distribution Boards & Hotspots", measure: "Periodic inspection, thermal scanning, and terminal tightening of electrical panels.", target_standard: "Zero abnormal hot spots detected", evidence_method: "Thermographic scan reports", max_weight: 15 },
      { order: 3, area: "Statutory Safety & EPRA License", measure: "Valid electrical contractor licensing, earthing tests, and zero exposed conductors.", target_standard: "100% statutory compliant", evidence_method: "EPRA licenses & audit report", max_weight: 15 },
      { order: 4, area: "Outage & Tripping Response TAT", measure: "Response time for tripped breakers, power phase loss, or short circuits.", target_standard: "< 1 hour response time", evidence_method: "Electrical incident tickets", max_weight: 15 },
      { order: 5, area: "Earthing & Lightning Protection", measure: "Testing and maintenance of ground earth pits and lightning arrestor conductor paths.", target_standard: "Earth resistance < 5 ohms", evidence_method: "Earth resistance test certificates", max_weight: 10 },
      { order: 6, area: "Power Factor Correction (PFC)", measure: "Inspection of PFC capacitor banks to prevent utility low power factor penalties.", target_standard: "Power factor maintained >= 0.95", evidence_method: "PFC controller readout logs", max_weight: 10 },
      { order: 7, area: "Sensors & Energy Automation", measure: "Calibration of daylight photocells, motion sensors, and digital timers.", target_standard: "Timers & sensors 100% accurate", evidence_method: "Automation audit checklist", max_weight: 10 },
      { order: 8, area: "Logbooks & Test Certification", measure: "Maintenance of electrical logbook, wiring schematics, and test documentation.", target_standard: "All modifications recorded", evidence_method: "Electrical logbook audit", max_weight: 5 },
    ],
  },
  waste: {
    key: "waste",
    name: "Waste Management & Recycling",
    code: "SL-WASTE",
    appraisal_frequency: "monthly",
    scope: "Collection, transfer, recycling, hazardous waste handling, bin room sanitization, and NEMA disposal manifests.",
    sla_standard: "Daily scheduled collection, spotless bin room, zero overflowing bins, 100% NEMA tracking manifests.",
    kpis: [
      { order: 1, area: "Collection Schedule Adherence", measure: "Timely collection and evacuation of garbage from designated building bin rooms.", target_standard: "Daily collection completed by 8 AM", evidence_method: "Waste collection register", max_weight: 20 },
      { order: 2, area: "Bin Room Sanitization", measure: "Washing, disinfecting, and deodorizing of bin rooms and bulk waste containers.", target_standard: "Bin rooms washed daily & odor-free", evidence_method: "Bin room inspection audit", max_weight: 15 },
      { order: 3, area: "Zero Waste Overflow", measure: "Ensuring no uncollected garbage, spillage, or overflowing waste bins on premises.", target_standard: "Zero overflowing bins or litter", evidence_method: "Daily grounds inspection", max_weight: 15 },
      { order: 4, area: "NEMA Compliance & Manifests", measure: "Valid NEMA waste transport licenses and fully signed waste tracking manifests.", target_standard: "100% NEMA compliant documentation", evidence_method: "NEMA waste transfer notes", max_weight: 15 },
      { order: 5, area: "Waste Segregation at Source", measure: "Facilitating separation of organic, recyclable (plastics, cardboard), and general refuse.", target_standard: "Segregated recycling bins maintained", evidence_method: "Recycling tonnage logs", max_weight: 15 },
      { order: 6, area: "Bulk & Hazardous Waste Removal", measure: "Arranging special disposal for construction debris, e-waste, and hazardous refuse.", target_standard: "Cleared within 48 hours of request", evidence_method: "Special disposal manifests", max_weight: 10 },
      { order: 7, area: "Handler PPE & Hygiene", measure: "Waste handlers equipped with heavy-duty safety gloves, boots, and face protection.", target_standard: "100% handler PPE compliance", evidence_method: "Safety supervisor check", max_weight: 5 },
      { order: 8, area: "Bin Condition & Maintenance", measure: "Regular inspection, wheel repair, and replacement of cracked or damaged wheelie bins.", target_standard: "All bins intact with closing lids", evidence_method: "Bin inventory audit", max_weight: 5 },
    ],
  },
};

export function ServiceLinesView({ organizationId, canAdminister = true }: ServiceLinesViewProps) {
  const router = useRouter();
  const [serviceLines, setServiceLines] = useState<Row[]>([]);
  const [properties, setProperties] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Record<string, RubricTemplate>>(CLIENT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Service Line dialog state
  const [openCreateLine, setOpenCreateLine] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("cleaning");
  const [newLineName, setNewLineName] = useState(CLIENT_TEMPLATES.cleaning.name);
  const [newLineCode, setNewLineCode] = useState(CLIENT_TEMPLATES.cleaning.code);
  const [newLinePropId, setNewLinePropId] = useState("");
  const [newLineFreq, setNewLineFreq] = useState(CLIENT_TEMPLATES.cleaning.appraisal_frequency);
  const [newLineSla, setNewLineSla] = useState(CLIENT_TEMPLATES.cleaning.sla_standard);
  const [newCustomKpis, setNewCustomKpis] = useState<RubricItem[]>(CLIENT_TEMPLATES.cleaning.kpis);
  const [creatingLine, setCreatingLine] = useState(false);

  // Scorecard modal state for existing service lines
  const [selectedLine, setSelectedLine] = useState<Row | null>(null);
  const [scorecardVersions, setScorecardVersions] = useState<Row[]>([]);
  const [activeVersion, setActiveVersion] = useState<Row | null>(null);
  const [kpis, setKpis] = useState<RubricItem[]>([]);
  const [savingKpis, setSavingKpis] = useState(false);

  const fetchServiceLines = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/facility/service-lines/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        setServiceLines(Array.isArray(data) ? data : []);
      } else {
        setError("Failed to load service lines.");
      }
    } catch {
      setError("Network error while loading service lines.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const fetchPropertiesAndTemplates = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [propRes, tplRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/facility/service-lines/rubric_templates/", {}, organizationId),
      ]);
      if (propRes.ok) {
        setProperties(await propRes.json());
      }
      if (tplRes.ok) {
        const data = await tplRes.json();
        if (data.templates && Array.isArray(data.templates)) {
          const dict: Record<string, RubricTemplate> = {};
          for (const t of data.templates) {
            dict[t.key] = t;
          }
          setTemplates(dict);
        }
      }
    } catch {
      // Keep CLIENT_TEMPLATES as fallback
    }
  }, [organizationId]);

  useEffect(() => {
    fetchServiceLines();
    fetchPropertiesAndTemplates();
  }, [fetchServiceLines, fetchPropertiesAndTemplates]);

  // Handle template selection in the New Service Line dialog
  const handleSelectTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    if (key === "custom") {
      setNewLineName("");
      setNewLineCode("");
      setNewLineFreq("monthly");
      setNewLineSla("");
      setNewCustomKpis([
        { order: 1, area: "Service Quality", measure: "Quality against contract SLA", target_standard: "100% compliant", evidence_method: "Inspection report", max_weight: 40 },
        { order: 2, area: "Responsiveness & TAT", measure: "Response to urgent repair calls", target_standard: "< 2 hours", evidence_method: "Job card timestamps", max_weight: 30 },
        { order: 3, area: "Statutory Compliance", measure: "Valid operating licenses and safety compliance", target_standard: "100% certified", evidence_method: "License certificate", max_weight: 20 },
        { order: 4, area: "Reporting & Audit", measure: "Submission of monthly service logs", target_standard: "Monthly report by 5th", evidence_method: "Service report file", max_weight: 10 },
      ]);
    } else {
      const tpl = templates[key] || CLIENT_TEMPLATES[key];
      if (tpl) {
        setNewLineName(tpl.name);
        setNewLineCode(tpl.code);
        setNewLineFreq(tpl.appraisal_frequency);
        setNewLineSla(tpl.sla_standard);
        setNewCustomKpis(tpl.kpis.map((k) => ({ ...k })));
      }
    }
  };

  // Seed default templates (Cleaning + Security or All)
  const handleSeedDefaults = async (templatesToSeed: "all" | "core") => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/facility/service-lines/seed_defaults/", {
        method: "POST",
        body: JSON.stringify({
          templates: templatesToSeed === "all" ? "all" : ["cleaning", "security"],
        }),
      }, organizationId);
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.detail || "Standard service lines and scorecards seeded successfully!");
        fetchServiceLines();
      } else {
        setError("Failed to seed default scorecards.");
      }
    } catch {
      setError("Network error while seeding default scorecards.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-balance weights function
  const autoBalanceWeights = (currentList: RubricItem[]): RubricItem[] => {
    if (!currentList.length) return currentList;
    const total = currentList.reduce((sum, item) => sum + (Number(item.max_weight) || 0), 0);
    if (total <= 0) {
      const base = Math.floor(100 / currentList.length);
      const rem = 100 - base * currentList.length;
      return currentList.map((item, idx) => ({
        ...item,
        max_weight: idx === currentList.length - 1 ? base + rem : base,
      }));
    }
    const scaled = currentList.map((item) => ({
      ...item,
      max_weight: Math.max(1, Math.round(((Number(item.max_weight) || 1) * 100) / total)),
    }));
    const newSum = scaled.reduce((sum, item) => sum + item.max_weight, 0);
    const diff = 100 - newSum;
    if (diff !== 0) {
      let maxIdx = 0;
      let maxVal = -1;
      scaled.forEach((item, idx) => {
        if (item.max_weight > maxVal) {
          maxVal = item.max_weight;
          maxIdx = idx;
        }
      });
      scaled[maxIdx].max_weight += diff;
    }
    return scaled;
  };

  // KPI management in New Service Line dialog
  const handleAddNewKpi = () => {
    setNewCustomKpis((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        area: "General Quality",
        measure: "",
        target_standard: "",
        evidence_method: "Inspection logs",
        max_weight: 5,
        is_active: true,
      },
    ]);
  };

  const handleUpdateNewKpi = (index: number, field: keyof RubricItem, value: unknown) => {
    setNewCustomKpis((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveNewKpi = (index: number) => {
    setNewCustomKpis((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAutoBalanceNewKpis = () => {
    setNewCustomKpis((prev) => autoBalanceWeights(prev));
  };

  const currentNewTotalWeight = newCustomKpis.reduce((sum, item) => sum + (Number(item.max_weight) || 0), 0);
  const isNewWeightValid = currentNewTotalWeight === 100;

  // Create Service Line + Scorecard together
  const handleCreateLine = async () => {
    if (!newLineName.trim()) {
      setError("Service Line Name is required.");
      return;
    }
    setCreatingLine(true);
    setError("");
    try {
      const res = await apiFetch("/facility/service-lines/", {
        method: "POST",
        body: JSON.stringify({
          name: newLineName.trim(),
          code: newLineCode.trim() || undefined,
          property: newLinePropId || null,
          appraisal_frequency: newLineFreq,
          sla_standard: newLineSla.trim(),
          is_active: true,
          rubric_template: selectedTemplateKey,
          custom_kpis: newCustomKpis,
        }),
      }, organizationId);
      if (res.ok) {
        setOpenCreateLine(false);
        setSuccessMsg(`Service Line "${newLineName}" created with 100% active scorecard!`);
        fetchServiceLines();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(JSON.stringify(errData) || "Failed to create service line.");
      }
    } catch {
      setError("Network error while creating service line.");
    } finally {
      setCreatingLine(false);
    }
  };

  // Scorecard Version Manager for existing Service Line
  const openScorecardManager = async (line: Row) => {
    setSelectedLine(line);
    const versions = (line.scorecard_versions as Row[]) || [];
    setScorecardVersions(versions);
    const active = versions.find((v) => v.status === "active") || versions[0] || null;
    setActiveVersion(active);
    if (active) {
      setKpis(((active.kpis as unknown) as RubricItem[]) || []);
    } else {
      setKpis([]);
    }
  };

  const handleSelectVersion = (version: Row) => {
    setActiveVersion(version);
    setKpis(((version.kpis as unknown) as RubricItem[]) || []);
  };

  const handleCreateNewVersion = async () => {
    if (!selectedLine || !organizationId) return;
    const nextNum = scorecardVersions.length + 1;
    const code = `V${nextNum}.0`;
    try {
      const res = await apiFetch("/facility/scorecard-versions/", {
        method: "POST",
        body: JSON.stringify({
          service_line: selectedLine.id,
          version_code: code,
          status: "draft",
          notes: `Draft version ${code}`,
        }),
      }, organizationId);
      if (res.ok) {
        const newVer = await res.json();
        if (kpis.length > 0) {
          await apiFetch(`/facility/scorecard-versions/${newVer.id}/save_kpis/`, {
            method: "POST",
            body: JSON.stringify({ kpis }),
          }, organizationId);
        }
        await fetchServiceLines();
        setSelectedLine((prev) => {
          if (!prev) return null;
          const updatedVers = [...((prev.scorecard_versions as Row[]) || []), newVer];
          return { ...prev, scorecard_versions: updatedVers };
        });
        setActiveVersion(newVer);
      }
    } catch {
      setError("Failed to create new version.");
    }
  };

  const handleAddVersionKpi = () => {
    setKpis((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        area: "Quality & Service Delivery",
        measure: "",
        target_standard: "",
        evidence_method: "Inspection checklist",
        max_weight: 5,
        is_active: true,
      },
    ]);
  };

  const handleUpdateVersionKpi = (index: number, field: keyof RubricItem, val: unknown) => {
    setKpis((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveVersionKpi = (index: number) => {
    setKpis((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAutoBalanceVersionKpis = () => {
    setKpis((prev) => autoBalanceWeights(prev));
  };

  const currentVersionTotalWeight = kpis.reduce((sum, item) => sum + (Number(item.max_weight) || 0), 0);
  const isVersionWeightValid = currentVersionTotalWeight === 100;

  const handleSaveKpis = async () => {
    if (!activeVersion || !organizationId) return;
    setSavingKpis(true);
    setError("");
    try {
      const res = await apiFetch(`/facility/scorecard-versions/${activeVersion.id}/save_kpis/`, {
        method: "POST",
        body: JSON.stringify({ kpis }),
      }, organizationId);
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg("Scorecard KPIs saved successfully!");
        fetchServiceLines();
        if (data.version) {
          setActiveVersion(data.version);
        }
      } else {
        setError("Failed to save KPIs.");
      }
    } catch {
      setError("Network error while saving KPIs.");
    } finally {
      setSavingKpis(false);
    }
  };

  const handleActivateScorecard = async () => {
    if (!activeVersion || !organizationId) return;
    if (!isVersionWeightValid) {
      setError(`Cannot activate: Total weight is ${currentVersionTotalWeight}%, must equal exactly 100%.`);
      return;
    }
    setSavingKpis(true);
    setError("");
    try {
      const res = await apiFetch(`/facility/scorecard-versions/${activeVersion.id}/activate/`, {
        method: "POST",
      }, organizationId);
      if (res.ok) {
        setSuccessMsg("Scorecard activated! It is now the active evaluation standard.");
        fetchServiceLines();
        setSelectedLine(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to activate scorecard.");
      }
    } catch {
      setError("Network error while activating scorecard.");
    } finally {
      setSavingKpis(false);
    }
  };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Action Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>
            Service Lines &amp; Scorecard Rubrics
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            Configure property service lines, adopt standardized 100% appraisal rubrics, or customize your own evaluation criteria.
          </Typography>
        </div>

        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => handleSeedDefaults("core")}
            startIcon={<Sparkles size={16} />}
            sx={{
              borderColor: "#2563eb",
              color: "#2563eb",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: "8px",
            }}
          >
            Seed Cleaning &amp; Security
          </Button>

          <Button
            variant="outlined"
            onClick={() => handleSeedDefaults("all")}
            startIcon={<Layers size={16} />}
            sx={{
              borderColor: "#059669",
              color: "#059669",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: "8px",
            }}
          >
            Seed All 11 Standard FM Rubrics
          </Button>

          {canAdminister && (
            <Button
              variant="contained"
              onClick={() => {
                handleSelectTemplate("cleaning");
                setOpenCreateLine(true);
              }}
              startIcon={<Plus size={16} />}
              sx={{
                background: "var(--color-brand-red, #dc2626)",
                color: "#ffffff",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: "8px",
                "&:hover": { background: "#b91c1c" },
              }}
            >
              New Service Line &amp; Rubric
            </Button>
          )}
        </Stack>
      </div>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: "8px" }}>
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg("")} sx={{ borderRadius: "8px" }}>
          {successMsg}
        </Alert>
      )}

      {/* Service Lines Table */}
      <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: "10px", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Service Line Name</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Property Scope</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Frequency</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Active Scorecard Rubric</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>SLA Standard</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#475569" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: "#64748b" }}>
                    Loading service lines...
                  </TableCell>
                </TableRow>
              ) : serviceLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 32 }}>📋</span>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>No Service Lines configured yet</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b", maxWidth: 450 }}>
                        Click &quot;Seed All 11 Standard FM Rubrics&quot; to initialize pre-configured 100% rubrics for Cleaning, Security, Lifts, Generators, HVAC, Fire Safety, and more!
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                serviceLines.map((line) => {
                  const activeSc = line.active_scorecard as Row | null;
                  const scCount = ((line.scorecard_versions as Row[]) || []).length;
                  const kpiCount = activeSc ? ((activeSc.kpis as Row[]) || []).length : 0;
                  return (
                    <TableRow key={line.id as string} hover>
                      <TableCell sx={{ fontWeight: 700, color: "#2563eb" }}>
                        {line.code as string}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{line.name as string}</TableCell>
                      <TableCell>{(line.property_name as string) || "Portfolio-Wide"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={String(line.appraisal_frequency || "monthly").toUpperCase()}
                          sx={{ fontWeight: 700, fontSize: "11px", bgcolor: "#eff6ff", color: "#1e40af" }}
                        />
                      </TableCell>
                      <TableCell>
                        {activeSc ? (
                          <Chip
                            size="small"
                            icon={<CheckCircle2 size={13} color="#16a34a" />}
                            label={`${activeSc.version_code} (${kpiCount} KPIs · 100%)`}
                            sx={{ fontWeight: 700, fontSize: "11px", bgcolor: "#f0fdf4", color: "#15803d" }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label={`${scCount} Draft(s)`}
                            sx={{ fontWeight: 600, fontSize: "11px", bgcolor: "#fffbeb", color: "#b45309" }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(line.sla_standard as string) || "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => router.push(`/facility?tab=appraisals&service_line=${line.id}&property=${line.property || ""}`)}
                            startIcon={<ClipboardCheck size={14} />}
                            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}
                          >
                            Appraise
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openScorecardManager(line)}
                            startIcon={<FileText size={14} />}
                            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px" }}
                          >
                            Manage Rubric ({scCount})
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog: Create New Service Line with Interactive Rubric Customizer */}
      <Dialog
        open={openCreateLine}
        onClose={() => setOpenCreateLine(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <div>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Create New Service Line &amp; Appraisal Rubric</Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Pick a pre-configured 100% industry template or build your own custom performance rubric.
            </Typography>
          </div>
          <IconButton onClick={() => setOpenCreateLine(false)}>
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          {/* Top Row: Template Selector */}
          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1e293b", mb: 1 }}>
              1. Choose a Standard Rubric Template (or customize from scratch):
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Rubric Template</InputLabel>
              <Select
                value={selectedTemplateKey}
                label="Rubric Template"
                onChange={(e) => handleSelectTemplate(e.target.value)}
              >
                <MenuItem value="custom" sx={{ fontWeight: 700, color: "#2563eb" }}>
                  ✏️ Custom / Blank Rubric (Define Your Own)
                </MenuItem>
                <Divider />
                {Object.values(templates).map((t) => (
                  <MenuItem key={t.key} value={t.key}>
                    ⭐ {t.name} ({t.kpis.length} KPIs · 100% Weight · {t.appraisal_frequency.toUpperCase()})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          {/* Service Line Meta Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <TextField
              size="small"
              label="Service Line Name"
              value={newLineName}
              onChange={(e) => setNewLineName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              size="small"
              label="Code (e.g. SL-CLEAN, SL-LIFT)"
              value={newLineCode}
              onChange={(e) => setNewLineCode(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth size="small">
              <InputLabel>Property Scope</InputLabel>
              <Select
                value={newLinePropId}
                label="Property Scope"
                onChange={(e) => setNewLinePropId(e.target.value)}
              >
                <MenuItem value="">Portfolio-Wide (All Properties)</MenuItem>
                {properties.map((p) => (
                  <MenuItem key={p.id as string} value={p.id as string}>
                    {p.name as string}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Appraisal Frequency</InputLabel>
              <Select
                value={newLineFreq}
                label="Appraisal Frequency"
                onChange={(e) => setNewLineFreq(e.target.value)}
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="semi_annual">Semi-Annual</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Contract SLA Standard / Objectives"
              value={newLineSla}
              onChange={(e) => setNewLineSla(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ gridColumn: "1 / -1" }}
            />
          </div>

          {/* Interactive Rubric Customizer Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  2. Customize Performance KPIs &amp; Weights:
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b" }}>
                  Each metric defines the responsibility, contract standard, audit evidence method, and max weight.
                </Typography>
              </div>

              {/* Weight Enforcement Meter & Auto-balance */}
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Chip
                  icon={isNewWeightValid ? <CheckCircle2 size={15} color="#15803d" /> : <AlertTriangle size={15} color="#b91c1c" />}
                  label={`Total Weight: ${currentNewTotalWeight}%`}
                  sx={{
                    fontWeight: 800,
                    bgcolor: isNewWeightValid ? "#f0fdf4" : "#fef2f2",
                    color: isNewWeightValid ? "#15803d" : "#b91c1c",
                    border: `1px solid ${isNewWeightValid ? "#bbf7d0" : "#fecaca"}`,
                  }}
                />

                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleAutoBalanceNewKpis}
                  startIcon={<Wand2 size={14} />}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}
                >
                  Auto-Balance to 100%
                </Button>

                <Button
                  size="small"
                  variant="contained"
                  onClick={handleAddNewKpi}
                  startIcon={<Plus size={14} />}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}
                >
                  Add KPI Metric
                </Button>
              </Stack>
            </div>

            {/* KPI Customizer Table */}
            <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e2e8f0", maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead sx={{ background: "#f8fafc" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 45 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 170 }}>Category / Area</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Responsibility / Metric Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Target Contract Standard</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 150 }}>Evidence / Audit</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: 90 }}>Weight (%)</TableCell>
                    <TableCell sx={{ width: 45 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {newCustomKpis.map((kpi, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 700, color: "#64748b" }}>{idx + 1}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={kpi.area}
                          onChange={(e) => handleUpdateNewKpi(idx, "area", e.target.value)}
                          fullWidth
                          variant="standard"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={kpi.measure}
                          onChange={(e) => handleUpdateNewKpi(idx, "measure", e.target.value)}
                          fullWidth
                          placeholder="e.g. Washroom cleaning and disinfecting"
                          variant="standard"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={kpi.target_standard}
                          onChange={(e) => handleUpdateNewKpi(idx, "target_standard", e.target.value)}
                          fullWidth
                          placeholder="e.g. Hourly log checklist"
                          variant="standard"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={kpi.evidence_method}
                          onChange={(e) => handleUpdateNewKpi(idx, "evidence_method", e.target.value)}
                          fullWidth
                          placeholder="e.g. Daily checklist"
                          variant="standard"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={Number(kpi.max_weight)}
                          onChange={(e) => handleUpdateNewKpi(idx, "max_weight", parseFloat(e.target.value) || 0)}
                          slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                          variant="standard"
                          sx={{ width: 60, input: { fontWeight: 800, textAlign: "center" } }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleRemoveNewKpi(idx)} color="error">
                          <Trash2 size={15} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
          <Button onClick={() => setOpenCreateLine(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleCreateLine}
            disabled={creatingLine}
            sx={{
              background: isNewWeightValid ? "var(--color-brand-red, #dc2626)" : "#64748b",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": { background: isNewWeightValid ? "#b91c1c" : "#475569" },
            }}
          >
            {creatingLine
              ? "Creating..."
              : isNewWeightValid
              ? "Create Service Line & Publish Active Scorecard"
              : `Save Service Line (Draft Scorecard: ${currentNewTotalWeight}%)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Scorecard Version Manager for Existing Service Line */}
      <Dialog
        open={Boolean(selectedLine)}
        onClose={() => setSelectedLine(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <div>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Scorecard Versioning: {selectedLine?.name as string}
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Code: {selectedLine?.code as string} · Frequency: {String(selectedLine?.appraisal_frequency || "").toUpperCase()}
            </Typography>
          </div>
          <IconButton onClick={() => setSelectedLine(null)}>
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* Version Switcher Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: "#f8fafc", padding: "10px 14px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Version:</Typography>
              <Stack direction="row" spacing={1}>
                {scorecardVersions.map((v) => {
                  const isActiveVer = activeVersion?.id === v.id;
                  const isLive = v.status === "active";
                  return (
                    <Chip
                      key={v.id as string}
                      label={`${v.version_code} ${isLive ? "(ACTIVE)" : "(DRAFT)"}`}
                      clickable
                      onClick={() => handleSelectVersion(v)}
                      color={isActiveVer ? "primary" : "default"}
                      variant={isActiveVer ? "filled" : "outlined"}
                      sx={{ fontWeight: 700, fontSize: "12px" }}
                    />
                  );
                })}
              </Stack>
            </div>

            <Button
              size="small"
              variant="outlined"
              onClick={handleCreateNewVersion}
              startIcon={<Plus size={14} />}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              New Draft Version
            </Button>
          </div>

          {/* 100% Total Weight Enforcement Indicator */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: "8px",
            border: `1px solid ${isVersionWeightValid ? "#86efac" : "#fca5a5"}`,
            background: isVersionWeightValid ? "#f0fdf4" : "#fef2f2",
            flexWrap: "wrap",
            gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isVersionWeightValid ? (
                <CheckCircle2 size={22} color="#15803d" />
              ) : (
                <AlertTriangle size={22} color="#b91c1c" />
              )}
              <div>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isVersionWeightValid ? "#15803d" : "#b91c1c" }}>
                  Total KPI Weight: {currentVersionTotalWeight}% {isVersionWeightValid ? "— Valid for Activation" : "— Invalid (Must equal 100%)"}
                </Typography>
                <Typography variant="caption" sx={{ color: isVersionWeightValid ? "#166534" : "#991b1b" }}>
                  {isVersionWeightValid
                    ? "All 100 points accounted for. This rubric meets governance standards."
                    : `Current sum is ${currentVersionTotalWeight}%. Adjust item max weights so they sum to exactly 100%.`}
                </Typography>
              </div>
            </div>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Button
                size="small"
                variant="outlined"
                onClick={handleAutoBalanceVersionKpis}
                startIcon={<Wand2 size={14} />}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Auto-Balance
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddVersionKpi}
                startIcon={<Plus size={14} />}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Add Metric
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveKpis}
                disabled={savingKpis}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {savingKpis ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={!isVersionWeightValid || savingKpis || activeVersion?.status === "active"}
                onClick={handleActivateScorecard}
                sx={{
                  bgcolor: "#15803d",
                  color: "#ffffff",
                  textTransform: "none",
                  fontWeight: 700,
                  "&:hover": { bgcolor: "#166534" },
                }}
              >
                Activate Scorecard
              </Button>
            </Stack>
          </div>

          {/* KPI List / Table */}
          <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e2e8f0", maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: 45 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 160 }}>Category / Area</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Responsibility / Metric Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Target Standard</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 140 }}>Evidence / Audit</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 85 }}>Weight (%)</TableCell>
                  <TableCell sx={{ width: 45 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {kpis.map((kpi, idx) => (
                  <TableRow key={(kpi.id as string) || idx} hover>
                    <TableCell sx={{ fontWeight: 700, color: "#64748b" }}>{idx + 1}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={kpi.area}
                        onChange={(e) => handleUpdateVersionKpi(idx, "area", e.target.value)}
                        fullWidth
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={kpi.measure}
                        onChange={(e) => handleUpdateVersionKpi(idx, "measure", e.target.value)}
                        fullWidth
                        placeholder="e.g. Washroom cleaning and disinfecting"
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={kpi.target_standard || ""}
                        onChange={(e) => handleUpdateVersionKpi(idx, "target_standard", e.target.value)}
                        fullWidth
                        placeholder="e.g. Hourly cleaning checks & logs"
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={kpi.evidence_method || ""}
                        onChange={(e) => handleUpdateVersionKpi(idx, "evidence_method", e.target.value)}
                        fullWidth
                        placeholder="Checklist / Log"
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={Number(kpi.max_weight)}
                        onChange={(e) => handleUpdateVersionKpi(idx, "max_weight", parseFloat(e.target.value) || 0)}
                        slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                        variant="standard"
                        sx={{ width: 60, input: { fontWeight: 800, textAlign: "center" } }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleRemoveVersionKpi(idx)} color="error">
                        <Trash2 size={15} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ServiceLinesView;
