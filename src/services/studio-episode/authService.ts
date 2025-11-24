
import { User } from "../../types/studio-episode";
import { register, login, getCurrentUserInfo, logout as apiLogout, getCurrentUser, setAuthToken } from "../../apiClient";

// Fallback to local storage if backend is not available
const SESSION_KEY = 'studio_session';

const colors = ['from-episode-400 to-episode-600', 'from-blue-400 to-blue-600', 'from-purple-400 to-purple-600', 'from-green-400 to-green-600'];

export const authService = {
  // Register a new user (uses BobPT backend)
  signup: async (name: string, email: string, password: string): Promise<User> => {
    try {
      // Use BobPT backend API
      const response = await register(email, password, name);
      
      // Convert BobPT user to studio-episode User format
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const user: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
      avatarColor: randomColor
    };

      // Store in local storage for compatibility
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      
      return user;
    } catch (error: any) {
      // Fallback to local storage if backend fails
      console.warn("Backend registration failed, using local storage:", error);
      throw error;
    }
  },

  // Login existing user (uses BobPT backend)
  login: async (email: string, password: string): Promise<User> => {
    try {
      // Use BobPT backend API
      const response = await login(email, password);
      
      // Convert BobPT user to studio-episode User format
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const user: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        avatarColor: randomColor
      };

      // Store in local storage for compatibility
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      
      return user;
    } catch (error: any) {
      console.error("Login failed:", error);
      throw error;
    }
  },

  // Logout (uses BobPT backend)
  logout: () => {
    apiLogout();
    localStorage.removeItem(SESSION_KEY);
  },

  // Get current session (checks both BobPT backend and local storage)
  getCurrentUser: (): User | null => {
    try {
      // First try to get from BobPT backend
      const bobptUser = getCurrentUser();
      if (bobptUser) {
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        return {
          id: bobptUser.id,
          name: bobptUser.name,
          email: bobptUser.email,
          avatarColor: randomColor
        };
      }
    } catch (error) {
      // Fallback to local storage
    }

    // Fallback to local storage
    const sessionJson = localStorage.getItem(SESSION_KEY);
    if (!sessionJson) return null;
    
    try {
      return JSON.parse(sessionJson);
    } catch {
      return null;
    }
  }
};
