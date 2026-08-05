import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

const API: AxiosInstance = axios.create({
  baseURL: API_URL,
});

// ================================
// Refresh token state
// ================================

let isRefreshing = false;

let failedQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });

  failedQueue = [];
};

// ================================
// Request interceptor
// ================================

API.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = Cookies.get(ACCESS_TOKEN_KEY);

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// ================================
// Response interceptor
// ================================

API.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // Không phải lỗi 401
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Không retry nhiều lần
    if (originalRequest._retry) {
      Cookies.remove(ACCESS_TOKEN_KEY);
      Cookies.remove(REFRESH_TOKEN_KEY);

      return Promise.reject(error);
    }

    // Đánh dấu request đang retry
    originalRequest._retry = true;

    // Lấy refresh token
    const refreshToken = Cookies.get(REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      Cookies.remove(ACCESS_TOKEN_KEY);
      Cookies.remove(REFRESH_TOKEN_KEY);

      return Promise.reject(error);
    }

    // Nếu đang có request khác refresh token
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }

            resolve(API(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const response = await axios.post(`${API_URL}/auth/refresh-token`, {
        refreshToken,
      });

      const newAccessToken = response.data.accessToken;
      const newRefreshToken = response.data.refreshToken;

      // Lưu access token mới
      Cookies.set(ACCESS_TOKEN_KEY, newAccessToken, {
        expires: 1,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      // Nếu backend trả refresh token mới
      if (newRefreshToken) {
        Cookies.set(REFRESH_TOKEN_KEY, newRefreshToken, {
          expires: 7,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }

      // Xử lý các request đang chờ
      processQueue(null, newAccessToken);

      // Gắn token mới cho request hiện tại
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }

      return API(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      Cookies.remove(ACCESS_TOKEN_KEY);
      Cookies.remove(REFRESH_TOKEN_KEY);

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default API;
