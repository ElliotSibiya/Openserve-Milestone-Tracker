import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { Project, PHASE_DISPLAY_NAMES, PHASE_ORDER, PhaseName } from '../types';
import { format } from 'date-fns';
import LoadingSpinner from './LoadingSpinner';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditProjectModal({
  project,
  onClose,
  onUpdated,
}: EditProjectModalProps) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'superadmin';

  const [siteSurveyDate, setSiteSurveyDate] = useState(
    format(new Date(project.siteSurveyDate), 'yyyy-MM-dd')
  );

  const initialPhases: Record<string, number> = {};
  const initialDeadlines: Record<string, string> = {};
  project.phases.forEach((phase) => {
    initialPhases[phase.phaseName] = phase.allowedDays;
    initialDeadlines[phase.phaseName] = format(new Date(phase.deadline), 'yyyy-MM-dd');
  });

  const [allowedDays, setAllowedDays] = useState(initialPhases);
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDaysChange = (phaseName: string, value: number) => {
    setAllowedDays((prev) => ({
      ...prev,
      [phaseName]: value,
    }));
  };

  const handleDeadlineChange = (phaseName: string, value: string) => {
    setDeadlines((prev) => ({
      ...prev,
      [phaseName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const phases = Object.entries(allowedDays)
        .filter(([name]) => name !== 'fqa' && name !== 'com')
        .map(([phaseName, days]) => {
          const phase: { phaseName: string; allowedDays: number; deadline?: string } = {
            phaseName,
            allowedDays: days,
          };
          // Include deadline if super admin and the deadline changed
          if (isSuperAdmin && deadlines[phaseName] !== initialDeadlines[phaseName]) {
            phase.deadline = deadlines[phaseName];
          }
          return phase;
        });

      await api.patch(`/projects/${project.id}`, {
        siteSurveyDate,
        phases,
      });

      onUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update project');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out mirror phases for editing
  const editablePhases = PHASE_ORDER.filter(
    (name) => name !== 'fqa' && name !== 'com'
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Edit Project</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site Survey Date
              </label>
              <input
                type="date"
                value={siteSurveyDate}
                onChange={(e) => setSiteSurveyDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-openserve-green focus:border-openserve-green outline-none"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Changing this will recalculate all phase deadlines
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase Settings
              </label>
              <div className="space-y-2">
                {editablePhases.map((phaseName) => (
                  <div
                    key={phaseName}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2"
                  >
                    <span className="text-sm font-medium text-gray-700 min-w-[120px]">
                      {PHASE_DISPLAY_NAMES[phaseName as PhaseName]}
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={allowedDays[phaseName] || 0}
                          onChange={(e) =>
                            handleDaysChange(phaseName, parseInt(e.target.value) || 0)
                          }
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-openserve-green focus:border-openserve-green outline-none text-center text-sm"
                        />
                        <span className="text-xs text-gray-500">days</span>
                      </div>
                      {isSuperAdmin && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={deadlines[phaseName] || ''}
                            onChange={(e) =>
                              handleDeadlineChange(phaseName, e.target.value)
                            }
                            className="px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-openserve-green focus:border-openserve-green outline-none text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Set Wayleave to 0 to skip it. FQA mirrors Build, COM mirrors RFA.
                {isSuperAdmin && (
                  <span className="block mt-1 text-purple-600">
                    Super Admin: Edit deadline dates directly. Changes cascade to future phases.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-openserve-green hover:bg-openserve-green-dark text-white rounded-lg transition-colors flex items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
