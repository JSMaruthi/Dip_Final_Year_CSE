import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const LoginPage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isAdmin ? '/api/admin/login' : '/api/login';
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token);
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">E-Waste Management</h1>
          <p className="text-gray-600">Sustainable waste collection system</p>
        </div>

        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setIsAdmin(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isAdmin ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
            }`}
          >
            User Login
          </button>
          <button
            onClick={() => setIsAdmin(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isAdmin ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
            }`}
          >
            Admin Login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your mobile number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : `Sign in as ${isAdmin ? 'Admin' : 'User'}`}
          </button>
        </form>

        {!isAdmin && (
          <div className="mt-6 text-center">
            <RegisterForm />
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3">Default Accounts:</h3>
          <div className="space-y-2 text-sm">
            <div><strong>Admin:</strong> 9999999999 / admin123</div>
            <div><strong>Collector:</strong> 8888888888 / collector123</div>
            <div><strong>User:</strong> 7777777777 / user123</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Register Component
const RegisterForm = () => {
  const [showRegister, setShowRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token);
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!showRegister) {
    return (
      <button
        onClick={() => setShowRegister(true)}
        className="text-blue-600 hover:text-blue-800 text-sm"
      >
        New user? Register here
      </button>
    );
  }

  return (
    <div className="border-t pt-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Register New User</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          type="tel"
          placeholder="Mobile Number"
          value={formData.mobile}
          onChange={(e) => setFormData({...formData, mobile: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
          <button
            type="button"
            onClick={() => setShowRegister(false)}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// Dashboard Components
const UserDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, token, logout } = useAuth();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'submitted': 'bg-yellow-100 text-yellow-800',
      'assigned': 'bg-blue-100 text-blue-800',
      'accepted': 'bg-purple-100 text-purple-800',
      'picked_up': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Dashboard</h1>
              <p className="text-gray-600">Welcome, {user?.name}</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">My E-Waste Requests</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Submit New Request
            </button>
          </div>

          {showCreateForm && (
            <CreateRequestForm 
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                fetchRequests();
              }}
            />
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="grid gap-6">
              {requests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                  <div className="text-gray-500 text-lg">No requests found</div>
                  <p className="text-gray-400 mt-2">Submit your first e-waste collection request</p>
                </div>
              ) : (
                requests.map(request => (
                  <div key={request.id} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{request.description}</h3>
                        <p className="text-gray-600">Quantity: {request.quantity}</p>
                        <p className="text-gray-600">Address: {request.pickup_address}</p>
                        <p className="text-gray-600">Contact: {request.contact_info}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>Created: {new Date(request.created_at).toLocaleDateString()}</p>
                      <p>Updated: {new Date(request.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const CreateRequestForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    description: '',
    quantity: '',
    pickup_address: '',
    contact_info: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to create request');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit E-Waste Request</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Describe your e-waste items"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="text"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 5 items, 2 boxes"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address</label>
            <textarea
              value={formData.pickup_address}
              onChange={(e) => setFormData({...formData, pickup_address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
              placeholder="Full pickup address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Information</label>
            <input
              type="text"
              value={formData.contact_info}
              onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Phone number or email"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const { user, token, logout } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsRes, collectorsRes, analyticsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/requests`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/collectors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/analytics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData);
      }

      if (collectorsRes.ok) {
        const collectorsData = await collectorsRes.json();
        setCollectors(collectorsData);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignCollector = async (requestId, collectorId, status = 'assigned') => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: status,
          assigned_collector_id: collectorId
        })
      });

      if (response.ok) {
        fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Error assigning collector:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'submitted': 'bg-yellow-100 text-yellow-800',
      'assigned': 'bg-blue-100 text-blue-800',
      'accepted': 'bg-purple-100 text-purple-800',
      'picked_up': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {user?.name}</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Requests</h3>
            <p className="text-3xl font-bold text-gray-900">{analytics.total_requests || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500">Pending</h3>
            <p className="text-3xl font-bold text-yellow-600">{analytics.pending_requests || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
            <p className="text-3xl font-bold text-blue-600">{analytics.in_progress_requests || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{analytics.completed_requests || 0}</p>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All E-Waste Requests</h2>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collector</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map(request => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{request.description}</div>
                          <div className="text-sm text-gray-500">Qty: {request.quantity}</div>
                          <div className="text-sm text-gray-500">{request.pickup_address}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.assigned_collector_id ? 
                          collectors.find(c => c.id === request.assigned_collector_id)?.name || 'Unknown' 
                          : 'Not assigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {request.status === 'submitted' && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignCollector(request.id, e.target.value);
                              }
                            }}
                            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                            defaultValue=""
                          >
                            <option value="">Assign Collector</option>
                            {collectors.map(collector => (
                              <option key={collector.id} value={collector.id}>
                                {collector.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Collector Dashboard
const CollectorDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, token, logout } = useAuth();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (requestId, status) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/collector/requests/${requestId}?status=${status}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchRequests(); // Refresh data
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'submitted': 'bg-yellow-100 text-yellow-800',
      'assigned': 'bg-blue-100 text-blue-800',
      'accepted': 'bg-purple-100 text-purple-800',
      'picked_up': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      'assigned': 'accepted',
      'accepted': 'picked_up',
      'picked_up': 'completed'
    };
    return statusFlow[currentStatus];
  };

  const getStatusLabel = (status) => {
    const labels = {
      'accepted': 'Mark as Accepted',
      'picked_up': 'Mark as Picked Up',
      'completed': 'Mark as Completed'
    };
    return labels[status];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Collector Dashboard</h1>
              <p className="text-gray-600">Welcome, {user?.name}</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Assigned Requests</h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="grid gap-6">
              {requests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                  <div className="text-gray-500 text-lg">No assigned requests</div>
                  <p className="text-gray-400 mt-2">You'll see requests assigned to you here</p>
                </div>
              ) : (
                requests.map(request => (
                  <div key={request.id} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{request.description}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <p><strong>Quantity:</strong> {request.quantity}</p>
                            <p><strong>Contact:</strong> {request.contact_info}</p>
                          </div>
                          <div>
                            <p><strong>Address:</strong> {request.pickup_address}</p>
                            <p><strong>Created:</strong> {new Date(request.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-6 flex flex-col items-end space-y-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {getNextStatus(request.status) && (
                          <button
                            onClick={() => updateStatus(request.id, getNextStatus(request.status))}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                          >
                            {getStatusLabel(getNextStatus(request.status))}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Main App Component
const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Route based on user role
  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'collector':
      return <CollectorDashboard />;
    case 'user':
      return <UserDashboard />;
    default:
      return <LoginPage />;
  }
};

// App with AuthProvider
const AppWithAuth = () => {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

export default AppWithAuth;