import API from "@/lib/api";
import { getApiErrorMessage } from "@/lib/get-api-error";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import Cookies from "js-cookie";

export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

// ================================
// LOGIN
// ================================

export const login = createAsyncThunk<
  AuthResponse,
  LoginPayload,
  {
    rejectValue: string;
  }
>("auth/login", async (data, thunkAPI) => {
  try {
    const response = await API.post<AuthResponse>("/auth/login", data);

    const result = response.data;

    Cookies.set("token", result.token, {
      expires: 1,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return result;
  } catch (error) {
    return thunkAPI.rejectWithValue(getApiErrorMessage(error, "Login failed"));
  }
});

// ================================
// REGISTER
// ================================

export const register = createAsyncThunk<
  AuthResponse,
  RegisterPayload,
  {
    rejectValue: string;
  }
>("auth/register", async (data, thunkAPI) => {
  try {
    const response = await API.post<AuthResponse>("/auth/register", data);

    const result = response.data;

    Cookies.set("token", result.token, {
      expires: 1,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return result;
  } catch (error) {
    return thunkAPI.rejectWithValue(getApiErrorMessage(error, "Login failed"));
  }
});

// ================================
// GET PROFILE
// ================================

export const getProfile = createAsyncThunk<
  User,
  void,
  {
    rejectValue: string;
  }
>("auth/getProfile", async (_, thunkAPI) => {
  try {
    const response = await API.get<User>("/auth/profile");

    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(getApiErrorMessage(error, "Login failed"));
  }
});

// ================================
// SLICE
// ================================

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;

      Cookies.remove("token");
      Cookies.remove("refreshToken");
    },
  },

  extraReducers: (builder) => {
    builder

      // ================================
      // LOGIN
      // ================================

      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })

      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
      })

      // ================================
      // REGISTER
      // ================================

      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })

      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Register failed";
      })

      // ================================
      // GET PROFILE
      // ================================

      .addCase(getProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(getProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })

      .addCase(getProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unauthorized";
      });
  },
});

export const { logout } = authSlice.actions;

export default authSlice.reducer;
