export interface Comment {
  id: string;
  content: string;
  created_at: string;
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
  status: string;
  comments: Comment[];
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
  parentId?: string;
  status: 'active' | 'completed' | 'archived';
  versions: Version[];
  review_deadline?: string | null; // <--- Esta línea es vital para que no falle
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
