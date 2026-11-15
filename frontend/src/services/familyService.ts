import { api } from './client';
import { PatientAccess, ConnectedPatient } from '../types';

export const familyService = {
  connectPatient: async (shareCode: string, relationshipLabel: string) => {
    const res = await api.post('/family/connect', {
      share_code: shareCode,
      relationship_label: relationshipLabel
    });
    return res.data;
  },

  getConnectedMembers: async (): Promise<PatientAccess[]> => {
    const res = await api.get<PatientAccess[]>('/family/members');
    return res.data;
  },

  revokeAccess: async (accessId: number) => {
    const res = await api.delete(`/family/members/${accessId}`);
    return res.data;
  },

  getConnectedPatients: async (): Promise<ConnectedPatient[]> => {
    const res = await api.get<ConnectedPatient[]>('/family/patients');
    return res.data;
  },

  regenerateCode: async () => {
    const res = await api.post('/family/regenerate-code');
    return res.data;
  }
};

// Backwards compatibility alias
export const familyAccessService = familyService;
