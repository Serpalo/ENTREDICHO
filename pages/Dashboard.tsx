import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Project, Folder, FileSystemItem, AppNotification } from '../types';
import { supabase } from '../supabase';

interface DashboardProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

type ViewMode = 'grid' | 'list';

const Dashboard: React.FC<DashboardProps> = ({ projects, setProjects, folders, setFolders, addNotification }) => {
  const { folderId } = useParams<{ folderId?: string }>();
  const currentFolderId = folderId || null;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<FileSystemItem | null>(null);

  // Modals for Notifications and Deadlines
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [activeEmailTab, setActiveEmailTab] = useState<"Publicidad" | "Dirección de producto">("Publicidad");
  const [newEmail, setNewEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const currentFolders = folders.filter(f => f.parentId === currentFolderId);
  const currentProjects = projects.filter(p => p.parentId === currentFolderId);

  // If no active project is set but we open a modal, default to the first project in view
  useEffect(() => {
    if ((showEmailModal || showCalendarModal) && !activeProjectId && currentProjects.length > 0) {
      setActiveProjectId(currentProjects[0].id);
    }
  }, [showEmailModal, showCalendarModal, activeProjectId, currentProjects]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Helper to split ISO to date and time
  const splitISO = (iso: string | undefined) => {
    if (!iso) return { date: '', time: '' };
    const dt = new Date(iso);
    const date = dt.toISOString().split('T')[0];
    const time = dt.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    return { date, time };
  };

  const [tempDates, setTempDates] = useState({
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "18:00"
  });

  // Sync temp dates when active project changes
  useEffect(() => {
    if (activeProject) {
      const si = splitISO(activeProject.correctionPeriod?.startDateTime);
      const ei = splitISO(activeProject.correctionPeriod?.endDateTime);
      setTempDates({
        startDate: si.date || new Date().toISOString().split('T')[0],
        startTime: si.time || "09:00",
        endDate: ei.date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endTime: ei.time || "18:00"
      });
    }
  }, [activeProjectId, activeProject?.correctionPeriod]);

  // Auto-expand current path in tree
  useEffect(() => {
    if (currentFolderId) {
      const newExpanded = new Set(expandedFolders);
      let currId: string | null = currentFolderId;
      while (currId) {
        const folder = folders.find(f => f.id === currId);
        if (folder && folder.parentId) {
          newExpanded.add(folder.parentId);
          currId = folder.parentId;
        } else {
          currId = null;
        }
      }
      setExpandedFolders(newExpanded);
    }
  }, [currentFolderId, folders]);

  const getBreadcrumbs = () => {
    const crumbs: { name: string; id: string | null }[] = [{ name: 'Proyectos', id: null }];
    let currentId = currentFolderId;
    const path: { name: string; id: string | null }[] = [];

    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (folder) {
        path.unshift({ name: folder.name, id: folder.id });
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    return [...crumbs, ...path];
  };

  const breadcrumbs = getBreadcrumbs();

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    const newFolder: Folder = {
      id: `f-${Date.now()}`,
      name: newFolderName,
      parentId: currentFolderId,
      type: 'folder'
    };
    setFolders(prev => [...prev, newFolder]);
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleRename = (item: FileSystemItem) => {
    setIsRenaming(item.id);
    setRenameValue(item.name);
  };

  const saveRename = () => {
    if (!isRenaming || !renameValue.trim()) {
      setIsRenaming(null);
      return;
    }
    const isFolder = folders.some(f => f.id === isRenaming);
    if (isFolder) {
      setFolders(prev => prev.map(f => f.id === isRenaming ? { ...f, name: renameValue } : f));
    } else {
      setProjects(prev => prev.map(p => p.id === isRenaming ? { ...p, name: renameValue } : p));
    }
    setIsRenaming(null);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'folder') {
      const deleteRecursive = (id: string, allFolders: Folder[]): string[] => {
        const ids = [id];
        const children = allFolders.filter(f => f.parentId === id);
        children.forEach(c => ids.push(...deleteRecursive(c.id, allFolders)));
        return ids;
      };
      const folderIdsToRemove = deleteRecursive(itemToDelete.id, folders);
      setFolders(prev => prev.filter(f => !folderIdsToRemove.includes(f.id)));
      setProjects(prev => prev.filter(p => !folderIdsToRemove.includes(p.parentId || '')));
    } else {
      setProjects(prev => prev.filter(p => p
