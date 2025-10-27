import { create } from 'zustand';
import { Notification } from './ToastNotification';

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  clearNotificationsByType: (type: Notification['type']) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notificationData) => {
    const notification: Notification = {
      ...notificationData,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    // Auto-remove if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(notification.id);
      }, notification.duration);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [] });
  },

  clearNotificationsByType: (type) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.type !== type),
    }));
  },
}));

// Convenience functions for common notification types
export const notify = {
  success: (title: string, message: string, duration = 5000) => {
    useNotificationStore.getState().addNotification({
      type: 'success',
      title,
      message,
      duration,
    });
  },

  error: (title: string, message: string, duration = 0, actions?: Notification['actions']) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title,
      message,
      duration,
      actions,
    });
  },

  warning: (title: string, message: string, duration = 7000) => {
    useNotificationStore.getState().addNotification({
      type: 'warning',
      title,
      message,
      duration,
    });
  },

  info: (title: string, message: string, duration = 5000) => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title,
      message,
      duration,
    });
  },

  // Workflow-specific notifications
  workflowStarted: (workflowName: string) => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Workflow Started',
      message: `"${workflowName}" is now running`,
      duration: 3000,
    });
  },

  workflowCompleted: (workflowName: string) => {
    useNotificationStore.getState().addNotification({
      type: 'success',
      title: 'Workflow Completed',
      message: `"${workflowName}" finished successfully`,
      duration: 5000,
    });
  },

  workflowFailed: (workflowName: string, error: string) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'Workflow Failed',
      message: `"${workflowName}" failed: ${error}`,
      duration: 0,
      actions: [
        {
          label: 'View Details',
          action: () => {
            // This would open an error details modal
            console.log('View error details');
          },
          style: 'primary',
        },
        {
          label: 'Retry',
          action: () => {
            // This would retry the workflow
            console.log('Retry workflow');
          },
          style: 'secondary',
        },
      ],
    });
  },

  nodeError: (nodeName: string, error: string) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'Node Error',
      message: `${nodeName}: ${error}`,
      duration: 0,
      actions: [
        {
          label: 'View Logs',
          action: () => {
            // This would switch to logs tab
            console.log('View logs');
          },
          style: 'primary',
        },
      ],
    });
  },

  gpuError: (gpuName: string, error: string) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'GPU Error',
      message: `${gpuName}: ${error}`,
      duration: 0,
      actions: [
        {
          label: 'Check GPU Status',
          action: () => {
            // This would switch to GPU monitor tab
            console.log('Check GPU status');
          },
          style: 'primary',
        },
      ],
    });
  },

  fileError: (operation: string, filename: string, error: string) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'File Error',
      message: `Failed to ${operation} "${filename}": ${error}`,
      duration: 0,
    });
  },

  connectionError: (service: string) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'Connection Error',
      message: `Lost connection to ${service}. Attempting to reconnect...`,
      duration: 0,
      actions: [
        {
          label: 'Retry Connection',
          action: () => {
            // This would retry the connection
            console.log('Retry connection');
          },
          style: 'primary',
        },
      ],
    });
  },
};
