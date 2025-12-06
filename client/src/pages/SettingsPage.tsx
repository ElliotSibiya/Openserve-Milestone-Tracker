import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { GlobalSettings } from '../types';
import { format } from 'date-fns';
import { Settings, Save, Info } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

interface SettingsField {
  key: keyof GlobalSettings;
  label: string;
  description?: string;
}

const SETTINGS_FIELDS: SettingsField[] = [
  { key: 'defaultPlanningDays', label: 'Planning Days', description: 'Time for project planning' },
  { key: 'defaultFundingDays', label: 'Funding Days', description: 'Time to secure funding' },
  { key: 'defaultWayleaveDays', label: 'Wayleave Days', description: 'Set to 0 to skip wayleave phase' },
  { key: 'defaultMaterialsDays', label: 'Materials Days', description: 'Time for materials procurement' },
  { key: 'defaultAnnouncementDays', label: 'Announcement Days', description: 'Time for announcements' },
  { key: 'defaultKickOffDays', label: 'Kick-Off Days', description: 'Time for project kick-off' },
  { key: 'defaultBuildDays', label: 'Build Days', description: 'Time for construction (FQA mirrors this)' },
  { key: 'defaultEccDays', label: 'ECC Days', description: 'Time for ECC completion' },
  { key: 'defaultIntegrationDays', label: 'Integration Days', description: 'Time for system integration' },
  { key: 'defaultRfaDays', label: 'RFA Days', description: 'Time for RFA (COM mirrors this)' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [formData, setFormData] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.settings);

      const data: Record<string, number> = {};
      SETTINGS_FIELDS.forEach(({ key }) => {
        data[key] = response.settings[key] as number;
      });
      setFormData(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, value: number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      await api.patch('/settings', formData);
      setSuccess('Settings saved successfully!');
      await fetchSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-openserve-green/10 rounded-lg">
          <Settings size={24} className="text-openserve-green" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Global Settings</h1>
          <p className="text-gray-500">
            Configure default values for new projects
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-800 font-medium">Important Note</p>
            <p className="text-blue-600 text-sm mt-1">
              These default values apply to newly created projects only.
              Existing projects keep their current values. Admin users can
              override these values for individual projects.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Default Phase Duration (Business Days)
            </h2>
          </div>

          <div className="p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
                {success}
              </div>
            )}

            <div className="grid gap-4">
              {SETTINGS_FIELDS.map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg gap-3"
                >
                  <div>
                    <label className="font-medium text-gray-800">{label}</label>
                    {description && (
                      <p className="text-sm text-gray-500">{description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={formData[key] || 0}
                      onChange={(e) =>
                        handleChange(key, parseInt(e.target.value) || 0)
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-openserve-green focus:border-openserve-green outline-none text-center"
                    />
                    <span className="text-gray-500 w-10">days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {settings?.updatedByUser && (
              <p className="text-sm text-gray-500">
                Last updated by {settings.updatedByUser.name} on{' '}
                {format(new Date(settings.updatedAt), 'dd MMM yyyy HH:mm')}
              </p>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="bg-openserve-green hover:bg-openserve-green-dark text-white font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <LoadingSpinner size="sm" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Defaults
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
