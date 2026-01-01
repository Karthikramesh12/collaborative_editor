import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AuthComponent.css';

export default function AuthComponent() {
  const [isLogin, setIsLogin] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    userName: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/login' : '/signUp';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : { email: formData.email, userName: formData.userName, password: formData.password };

      const response = await fetch(`${API_URL}/auth${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("auth_token", data.data.user.token);
        localStorage.setItem("client_id", data.data.user.user.id);
        console.log("client ID: ", localStorage.getItem(("client_id")));
        navigate("/dashboard");
      } else {
        setError(data.message || 'An error occurred');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', userName: '', password: '' });
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-split-layout">
        {/* Left Side - Hero Image */}
        <div className="login-hero">
          <img 
            src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&q=80" 
            alt="Developer workspace" 
            className="hero-image"
          />
        </div>

        {/* Right Side - Form */}
        <div className="login-form-section">
          <div className="login-box">
            <div className="login-header">
              <h1 className="login-title">{isLogin ? 'Welcome back!' : 'Create an account'}</h1>
              <p className="login-subtitle">
                {isLogin ? 'We re excited to see you again!' : 'Join the developer community today'}
              </p>
            </div>

            <div className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email <span className="required">*</span>
                </label>
                <input
                  type="email"
                  className="form-control custom-input"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="userName" className="form-label">
                    Username <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control custom-input"
                    id="userName"
                    name="userName"
                    value={formData.userName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password <span className="required">*</span>
                </label>
                <input
                  type="password"
                  className="form-control custom-input"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {isLogin && (
                <div className="forgot-password">
                  <a href="#" className="forgot-link">Forgot your password?</a>
                </div>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button 
                onClick={handleSubmit}
                className="btn btn-primary submit-btn"
                disabled={loading}
              >
                {loading ? 'Loading...' : (isLogin ? 'Login' : 'Continue')}
              </button>

              <div className="toggle-mode">
                <span className="toggle-text">
                  {isLogin ? "Need an account? " : "Already have an account? "}
                </span>
                <button type="button" className="toggle-link" onClick={toggleMode}>
                  {isLogin ? 'Register' : 'Login'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}