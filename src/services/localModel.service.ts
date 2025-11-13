import axios from 'axios';
import config from '../config/env';

export class LocalModelService {
  static async answer(prompt: string) {
    if (!config.localModelUrl) {
      return { answer: null };
    }

    try {
      const res = await axios.post(`${config.localModelUrl}/generate`, { prompt });
      return res.data; // { answer: string }
    } catch (error: any) {
      console.warn("[LocalModelService] Request failed", error?.message || error);
      throw error;
    }
  }
}
