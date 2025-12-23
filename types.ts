
export enum CorrectionStatus {
  FIRST = "1ª CORRECCIÓN",
  SECOND = "2ª CORRECCIÓN",
  THIRD = "3ª CORRECCIÓN",
  PRINT = "IMPRENTA"
}

export type ReviewerRole = "Publicidad" | "Dirección de producto";
export type CommentStatus = "pending" | "in-progress" | "resolved";

export interface Comment {
  id: string;
  author: string;
  role: ReviewerRole;
  text: string;
  timestamp: Date;
  x: number;
  y: number;
  status: CommentStatus;
}

export interface ReviewerApproval {
  role: ReviewerRole;
  approved: boolean;
  pending: boolean;
}

export interface BrochurePage {
  id: string;
  pageNumber: number;
  imageUrl: string;
  annotationsLayer?: string; // Capa de dibujo en formato Data URL (PNG transparente)
  status: CorrectionStatus;
  approvals: Record<ReviewerRole, ReviewerApproval>;
  comments: Comment[];
  generalNotes?: string;
}

export interface BrochureVersion {
  id: string;
  versionNumber: number;
  createdAt: Date;
  pages: BrochurePage[];
  isActive: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  type: 'folder';
}

export interface CorrectionPeriod {
  startDateTime: string; // ISO string including time
  endDateTime: string;   // ISO string including time
}

export interface Project {
  id: string;
  name: string;
  parentId: string | null;
  type: 'project';
  versions: BrochureVersion[];
  advertisingEmails?: string[];
  productDirectionEmails?: string[];
  correctionPeriod?: CorrectionPeriod;
}

export interface AppNotification {
  id: string;
  type: 'comment' | 'approval' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

export type FileSystemItem = Folder | Project;
