import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Project, ProjectPhase, PHASE_DISPLAY_NAMES, PHASE_ORDER, PhaseName } from '../types';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  FileText,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EditProjectModal from '../components/EditProjectModal';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [completingPhase, setCompletingPhase] = useState<string | null>(null);

  const { user } = useAuthStore();
  const { fetchNotifications } = useNotificationStore();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      setProject(response.project || response);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const handleCompletePhase = async (phase: ProjectPhase) => {
    setCompletingPhase(phase.id);
    try {
      if (phase.isComplete) {
        await api.post(`/phases/${phase.id}/uncomplete`);
      } else {
        await api.post(`/phases/${phase.id}/complete`);
      }
      await fetchProject();
      fetchNotifications();
    } catch (error) {
      console.error('Failed to update phase:', error);
    } finally {
      setCompletingPhase(null);
    }
  };

  const getPhaseStatus = (phase: ProjectPhase) => {
    if (phase.isComplete) return 'complete';
    if (phase.phaseName === 'wayleave' && phase.allowedDays === 0) return 'skipped';
    const days = phase.daysUntilDeadline || 0;
    if (days < 0) return 'overdue';
    if (days <= 1) return 'urgent';
    if (days <= 3) return 'warning';
    return 'on-track';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'overdue':
        return <AlertCircle size={20} className="text-red-500" />;
      case 'urgent':
        return <AlertTriangle size={20} className="text-orange-500" />;
      case 'warning':
        return <Clock size={20} className="text-yellow-500" />;
      case 'skipped':
        return <span className="text-gray-400 text-sm">Skipped</span>;
      default:
        return <Clock size={20} className="text-green-500" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-50 border-green-200';
      case 'overdue':
        return 'bg-red-50 border-red-200';
      case 'urgent':
        return 'bg-orange-50 border-orange-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'skipped':
        return 'bg-gray-50 border-gray-200 opacity-50';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const formatDaysUntil = (days: number | undefined, isComplete: boolean) => {
    if (isComplete) return 'Completed';
    if (days === undefined) return '';
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
    return `${days} day${days !== 1 ? 's' : ''} remaining`;
  };

  const isMirrorPhase = (phaseName: string) => {
    return phaseName === 'fqa' || phaseName === 'com';
  };

  const getMirrorSource = (phaseName: string) => {
    if (phaseName === 'fqa') return 'build';
    if (phaseName === 'com') return 'rfa';
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  // Sort phases by PHASE_ORDER
  const sortedPhases = [...project.phases].sort(
    (a, b) =>
      PHASE_ORDER.indexOf(a.phaseName as PhaseName) -
      PHASE_ORDER.indexOf(b.phaseName as PhaseName)
  );

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Projects
      </button>

      {/* Project Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {project.orderNumber}
            </h1>
            <p className="text-lg text-gray-600">{project.customerName}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit size={18} />
              Edit Project
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">PNR</p>
              <p className="font-medium text-gray-800">{project.pnr}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Building2 size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Timeline Provided By</p>
              <p className="font-medium text-gray-800">{project.timelineProvidedBy}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Calendar size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Timeline Date Provided</p>
              <p className="font-medium text-gray-800">
                {format(new Date(project.timelineDateProvided), 'dd MMM yyyy')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-openserve-green/10 rounded-lg">
              <Calendar size={20} className="text-openserve-green" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Site Survey Date</p>
              <p className="font-medium text-gray-800">
                {format(new Date(project.siteSurveyDate), 'dd MMM yyyy')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
          <User size={16} />
          Created by {project.createdByUser.name} on{' '}
          {format(new Date(project.createdAt), 'dd MMM yyyy')}
        </div>
      </div>

      {/* Phases */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Project Phases</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {sortedPhases.map((phase) => {
            const status = getPhaseStatus(phase);
            const isSkipped = phase.phaseName === 'wayleave' && phase.allowedDays === 0;
            const isMirror = isMirrorPhase(phase.phaseName);
            const mirrorSource = getMirrorSource(phase.phaseName);

            if (isSkipped) return null;

            return (
              <div
                key={phase.id}
                className={`p-4 ${getStatusBg(status)} border-l-4 ${
                  status === 'complete'
                    ? 'border-l-green-500'
                    : status === 'overdue'
                    ? 'border-l-red-500'
                    : status === 'urgent'
                    ? 'border-l-orange-500'
                    : status === 'warning'
                    ? 'border-l-yellow-500'
                    : 'border-l-gray-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 min-w-[140px]">
                      {getStatusIcon(status)}
                      <span className="font-medium text-gray-800">
                        {PHASE_DISPLAY_NAMES[phase.phaseName as PhaseName]}
                      </span>
                    </div>

                    <div className="text-sm text-gray-500">
                      {!isMirror && (
                        <span className="mr-4">
                          {phase.allowedDays} day{phase.allowedDays !== 1 ? 's' : ''}
                          {isAdmin && (
                            <button
                              onClick={() => setShowEditModal(true)}
                              className="ml-1 text-openserve-green hover:underline"
                            >
                              (edit)
                            </button>
                          )}
                        </span>
                      )}
                      {isMirror && mirrorSource && (
                        <span className="text-gray-400 italic">
                          Same as {PHASE_DISPLAY_NAMES[mirrorSource as PhaseName]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-sm">
                      <span className="text-gray-500">Deadline: </span>
                      <span className="font-medium text-gray-800">
                        {format(new Date(phase.deadline), 'dd MMM yyyy')}
                      </span>
                    </div>

                    <div
                      className={`text-sm font-medium min-w-[120px] ${
                        status === 'complete'
                          ? 'text-green-600'
                          : status === 'overdue'
                          ? 'text-red-600'
                          : status === 'urgent'
                          ? 'text-orange-600'
                          : status === 'warning'
                          ? 'text-yellow-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {formatDaysUntil(phase.daysUntilDeadline, phase.isComplete)}
                    </div>

                    {!isMirror && (
                      <button
                        onClick={() => handleCompletePhase(phase)}
                        disabled={
                          completingPhase === phase.id ||
                          (phase.isComplete && !isAdmin)
                        }
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                          phase.isComplete
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {completingPhase === phase.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            {phase.isComplete ? 'Done' : 'Mark Complete'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {phase.isComplete && phase.completedByUser && (
                  <div className="mt-2 text-sm text-gray-500">
                    Completed by {phase.completedByUser.name} on{' '}
                    {format(new Date(phase.completedAt!), 'dd MMM yyyy HH:mm')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onUpdated={() => {
            setShowEditModal(false);
            fetchProject();
          }}
        />
      )}
    </div>
  );
}
