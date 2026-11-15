// Centralized API facade: re-exports client instance and domain services
export { api, API_BASE_URL } from './client';
export { authService } from './authService';
export { dashboardService } from './dashboardService';
export { medicationService, adherenceService } from './medicationService';
export { appointmentService } from './appointmentService';
export { familyService, familyAccessService } from './familyService';
export { notificationService } from './notificationService';
export { activityService } from './activityService';
export { aiSummaryService } from './aiSummaryService';
