export interface Task {
  id?: string; // Firestore otomatik ID
  title: string;
  description: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  dueDate?: Date;
}
