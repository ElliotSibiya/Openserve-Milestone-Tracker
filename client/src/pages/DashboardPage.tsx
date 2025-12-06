import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { Project, ProjectStatus } from '../types';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Eye,
  Trash2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import CreateProjectModal from '../components/CreateProjectModal';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { user } = useAuthStore();
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(Array.isArray(response) ? response : response.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${id}`);
      setProjects(projects.filter((p) => p.id !== id));
      setDeleteId(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.toLowerCase();
    return (
      project.orderNumber.toLowerCase().includes(query) ||
      project.customerName.toLowerCase().includes(query) ||
      project.pnr.toLowerCase().includes(query)
    );
  });

  const getStatusIcon = (status: ProjectStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'overdue':
        return <AlertCircle size={18} className="text-red-500" />;
      case 'at-risk':
        return <AlertTriangle size={18} className="text-yellow-500" />;
      default:
        return <Clock size={18} className="text-green-500" />;
    }
  };

  const getStatusLabel = (status: ProjectStatus) => {
    switch (status) {
      case 'complete':
        return 'Complete';
      case 'overdue':
        return 'Overdue';
      case 'at-risk':
        return 'At Risk';
      default:
        return 'On Track';
    }
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'complete':
        return 'bg-gray-50';
      case 'overdue':
        return 'bg-red-50';
      case 'at-risk':
        return 'bg-yellow-50';
      default:
        return 'bg-white';
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
          <p className="text-gray-500">
            {projects.length} total project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-openserve-green hover:bg-openserve-green-dark text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by order number, customer name, or PNR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-openserve-green focus:border-openserve-green outline-none transition-colors"
          />
        </div>
      </div>

      {/* Projects Table */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-1">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Create your first project to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-openserve-green hover:bg-openserve-green-dark text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                    Order Number
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                    Customer Name
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">
                    PNR
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">
                    Created By
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden sm:table-cell">
                    Site Survey
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">
                    Progress
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className={`${getStatusColor(
                      project.status || 'on-track'
                    )} hover:bg-gray-50 cursor-pointer transition-colors`}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">
                        {project.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {project.customerName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {project.pnr}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {project.createdByUser.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {format(new Date(project.siteSurveyDate), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(project.status || 'on-track')}
                        <span className="text-sm">
                          {getStatusLabel(project.status || 'on-track')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className="h-full bg-openserve-green rounded-full transition-all"
                            style={{
                              width: `${
                                ((project.completedPhases || 0) /
                                  (project.totalPhases || 1)) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {project.completedPhases}/{project.totalPhases}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${project.id}`);
                          }}
                          className="p-2 text-gray-400 hover:text-openserve-green hover:bg-green-50 rounded-lg transition-colors"
                          title="View project"
                        >
                          <Eye size={18} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(project.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete project"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchProjects();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Delete Project?
            </h3>
            <p className="text-gray-500 mb-6">
              This action cannot be undone. All project data including phases and
              notifications will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
