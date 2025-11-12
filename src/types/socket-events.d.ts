import { Socket as IOSocket } from 'socket.io';

export interface ClientToServerEvents {
  'question:send': (payload: { userId: string; text: string }) => void;
}

export interface ServerToClientEvents {
  'question:ack': (payload: { status: string; text: string }) => void;
  'status:update': (payload: { stage: string; meta?: any }) => void;
  'question:done': (payload: { answer: any; quality?: any }) => void;
  'question:error': (payload: { message: string }) => void;
}

export type TypedSocket = IOSocket<ClientToServerEvents, ServerToClientEvents>;
