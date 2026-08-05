import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import API from "@/lib/api";
import { getApiErrorMessage } from "@/lib/get-api-error";

export interface SearchUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface UserState {
  onlineUsers: string[];
  users: SearchUser[];
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  onlineUsers: [],
  users: [],
  loading: false,
  error: null,
};

export interface SearchUsersPayload {
  keyword?: string;
  currentUserId?: string;
}

// ================================
// SEARCH USERS
// ================================

export const searchUsers = createAsyncThunk<
  SearchUser[],
  SearchUsersPayload,
  {
    rejectValue: string;
  }
>("users/searchUsers", async ({ keyword, currentUserId }, thunkAPI) => {
  try {
    const params = new URLSearchParams();

    if (keyword) {
      params.append("keyword", keyword);
    }

    if (currentUserId) {
      params.append("currentUserId", currentUserId);
    }

    const response = await API.get<SearchUser[]>("/users/search", {
      params,
    });

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to search users"),
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
      });
  },
});

export const { clearUsers, addOnlineUser, removeOnlineUser, setOnlineUsers } =
  userSlice.actions;

export default userSlice.reducer;
