export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface SubtitleBlock {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  speaker?: string;
  isEdited?: boolean;
}

export interface Project {
  id: string;
  userId: string; // Linked to User
  name: string;
  lastModified: Date;
  thumbnailUrl?: string;
  durationString?: string;
  type: 'UPLOAD' | 'YOUTUBE' | 'SHORTS';
}

export enum AppView {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  EDITOR = 'EDITOR',
}

export interface VideoState {
  file: File | null;
  url: string | null;
  youtubeUrl?: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
}

export interface Highlight {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  viralScore: number; // 1-100
  reason: string;
}

export type EditorTab = 'CAPTIONS' | 'TRANSLATE' | 'SHORTS' | 'THUMBNAIL' | 'EXPORT';


