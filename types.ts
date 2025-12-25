export interface Comment {
  id: string;
  content: string;
  created_at: string; // Coincide con la DB
  page_id: string;
  x: number;
  y: number;
  resolved: boolean;
  attachment_url?: string | null;
}

export interface Page {
  id: string;
  imageUrl: string;
  pageNumber: number;
  version: number;
  status: '1ª corrección' | '2ª corrección' | '3ª corrección' | '4ª corrección' | '5ª corrección' | 'Imprenta';
  comments: Comment[];
  // approvals eliminados para simplificar, usamos status
}

export interface Version {
  id: string;
  versionNumber: number;
  pages: Page[];
}

export interface Project {
  id: string;
  name: string;
  type: 'project';
  parentId?: string; // Para carpetas
  status: 'active' | 'completed' | 'archived';
  versions: Version[];
  review_deadline?: string | null; // <--- ¡AQUÍ ESTÁ LA CLAVE! 📅
}

export interface Folder {
  id: string;
  name: string;
  type: 'folder';
  parentId?: string;
}

export interface AppNotification {
  id: string;
  type: 'system' | 'user';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}
