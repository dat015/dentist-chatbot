import axios from 'axios';
import config from '../config/env';

export class LocalModelService {
  static async answer(prompt: string) {
    console.log("hrhr")
    const res = await axios.post(`${config.localModelUrl}/generate`, { prompt });
    return res.data; // { answer: string }
  }
}
