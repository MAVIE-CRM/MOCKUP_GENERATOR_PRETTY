import axios from 'axios';
import { config } from '../config';

const BASE_URL = `${config.apiUrl}/api/flora`;

export interface FloraResponse {
  runId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  outputs?: any[];
  errorCode?: string;
  errorMessage?: string;
}

export interface MockupParams {
  image: string;
  technique: string;
}

export const floraService = {
  /**
   * Inizia una nuova generazione su Flora AI
   */
  async startGeneration(mockupParams: MockupParams): Promise<string> {
    try {
      const publicUrl = mockupParams.image; 
      const pass = localStorage.getItem('pretty_auth') || '';

      const response = await axios.post(`${BASE_URL}/generate`, {
        inputs: [
          {
            id: 'colorful-diffuser-design',
            type: 'imageUrl',
            value: publicUrl
          }
        ],
        mode: 'async'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': pass
        }
      });
      
      return response.data.runId;
    } catch (error: any) {
      console.error('Flora AI Start Error:', error.response?.data || error.message);
      throw new Error(`Errore Flora AI: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
    }
  },

  /**
   * Controlla lo stato della generazione
   */
  async pollStatus(runId: string, technique: string): Promise<FloraResponse> {
    try {
      const pass = localStorage.getItem('pretty_auth') || '';
      const response = await axios.get(`${BASE_URL}/status/${runId}`, {
        headers: { 'x-api-key': pass }
      });
      return response.data;
    } catch (error: any) {
      console.error('Flora AI Polling Error:', error);
      throw new Error(`Errore Polling: ${error.response?.data?.error?.message || error.message}`);
    }
  }
};
