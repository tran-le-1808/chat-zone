import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import API from "@/lib/api";
import { getApiErrorMessage } from "@/lib/get-api-error";

export interface SearchUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface EditUserPayload {
  name?: string;
  avatar?: string;
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

interface UserState {
  onlineUsers: string[];
  users: SearchUser[];
  loading: boolean;
  updateSuccessMessage: string | null;
  error: string | null;
}

const initialState: UserState = {
  onlineUsers: [],
  users: [],
  loading: false,
  updateSuccessMessage: null,
  error: null,
};

export interface SearchUsersPayload {
  keyword?: string;
  currentUserId?: string;
}

export const searchUsers = createAsyncThunk<
  SearchUser[],
  SearchUsersPayload,
  { rejectValue: string }
>("users/searchUsers", async ({ keyword, currentUserId }, thunkAPI) => {
  try {
    const params = new URLSearchParams();
    if (keyword) params.append("keyword", keyword);
    if (currentUserId) params.append("currentUserId", currentUserId);

    const response = await API.get<SearchUser[]>("/users/search", { params });
    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to search users"),
    );
  }
});

// THUNK EDIT PROFILE
export const editProfile = createAsyncThunk<
  SearchUser,
  { name?: string; file?: File | null },
  { rejectValue: string }
>("users/edit", async ({ name, file }, thunkAPI) => {
  try {
    const formData = new FormData();

    if (name) formData.append("name", name);

    if (file) formData.append("file", file);

    const response = await API.put<SearchUser>("/users/edit", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Cập nhật thông tin thất bại"),
    );
  }
});

// THUNK CHANGE PASSWORD
export const changePassword = createAsyncThunk<
  { message: string },
  ChangePasswordPayload,
  { rejectValue: string }
>("users/changePassword", async (payload, thunkAPI) => {
  try {
    const response = await API.put<{ message: string }>(
      "/users/change-password",
      payload,
    );
    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Đổi mật khẩu thất bại"),
    );
  }
});

const userSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    clearUsers: (state) => {
      state.users = [];
    },
    clearUserStatus: (state) => {
      state.error = null;
      state.updateSuccessMessage = null;
    },
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = action.payload;
    },
    addOnlineUser: (state, action: PayloadAction<string>) => {
      if (!state.onlineUsers.includes(action.payload)) {
        state.onlineUsers.push(action.payload);
      }
    },
    removeOnlineUser: (state, action: PayloadAction<string>) => {
      state.onlineUsers = state.onlineUsers.filter(
        (id) => id !== action.payload,
      );
    },
  },
  extraReducers: (builder) => {
    builder
      // SEARCH USERS
      .addCase(searchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Error";
      })
      // EDIT PROFILE
      .addCase(editProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.updateSuccessMessage = null;
      })
      .addCase(editProfile.fulfilled, (state) => {
        state.loading = false;
        state.updateSuccessMessage = "Cập nhật thông tin cá nhân thành công!";
      })
      .addCase(editProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Lỗi cập nhật thông tin";
      })
      // CHANGE PASSWORD
      .addCase(changePassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.updateSuccessMessage = null;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.loading = false;
        state.updateSuccessMessage = action.payload.message;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Lỗi đổi mật khẩu";
      });
  },
});

export const {
  clearUsers,
  clearUserStatus,
  addOnlineUser,
  removeOnlineUser,
  setOnlineUsers,
} = userSlice.actions;

export default userSlice.reducer;
