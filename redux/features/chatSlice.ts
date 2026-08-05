import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { User } from "./authSlice";
import API from "@/lib/api";
import { getApiErrorMessage } from "@/lib/get-api-error";

import {
  Conversation,
  ConversationsResponse,
  GetConversationsPayload,
  GetMessagesResponse,
  Message,
} from "@/types/chat";

export interface CreateGroupPayload {
  formData: FormData;
}

interface LoadMoreMessagesPayload {
  conversationId: string;
  before: string;
}

interface ChatState {
  conversations: Conversation[];
  messages: Message[];
  selectedConversation: Conversation | null;
  loading: boolean;
  sending: boolean;
  creatingGroup: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  total: number;
  selectedUser: User | null;
  nextCursor: string | null;
  hasMoreMessages: boolean;
  loadingMoreMessages: boolean;
}

const initialState: ChatState = {
  conversations: [],
  messages: [],
  selectedConversation: null,
  loading: false,
  sending: false,
  creatingGroup: false,
  error: null,
  page: 1,
  hasMore: false,
  total: 0,
  selectedUser: null,
  hasMoreMessages: false,
  nextCursor: null,
  loadingMoreMessages: false,
};

//
// GET CONVERSATIONS
//

export const getConversations = createAsyncThunk<
  ConversationsResponse,
  GetConversationsPayload,
  {
    rejectValue: string;
  }
>("chat/getConversations", async (data, thunkAPI) => {
  try {
    const response = await API.get<ConversationsResponse>(
      "/chat/conversations",
      {
        params: {
          userId: data.userId,
          page: data.page || 1,
          limit: data.limit || 10,
          search: data.search || "",
        },
      },
    );

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to load conversations"),
    );
  }
});

//
// CREATE GROUP
//

export const createGroup = createAsyncThunk<
  Conversation,
  CreateGroupPayload,
  {
    rejectValue: string;
  }
>("chat/createGroup", async ({ formData }, thunkAPI) => {
  try {
    const response = await API.post<Conversation>(
      "/chat/create-group",
      formData,
    );

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to create group"),
    );
  }
});

//
// CREATE CONVERSATION
//

export const createConversation = createAsyncThunk<
  Conversation,
  {
    receiverId: string;
  },
  {
    rejectValue: string;
  }
>("chat/createConversation", async (data, thunkAPI) => {
  try {
    const response = await API.post<Conversation>(
      "/chat/create-conversation",
      data,
    );

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to create conversation"),
    );
  }
});

//
// GET MESSAGES
//

export const loadMoreMessages = createAsyncThunk<
  GetMessagesResponse,
  LoadMoreMessagesPayload,
  {
    rejectValue: string;
  }
>("chat/loadMoreMessages", async ({ conversationId, before }, thunkAPI) => {
  try {
    const response = await API.get<GetMessagesResponse>(
      `/chat/messages/${conversationId}`,
      {
        params: {
          limit: 20,
          before,
        },
      },
    );

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to load more messages"),
    );
  }
});

export const getMessages = createAsyncThunk<
  GetMessagesResponse,
  string,
  {
    rejectValue: string;
  }
>("chat/getMessages", async (conversationId, thunkAPI) => {
  try {
    const response = await API.get<GetMessagesResponse>(
      `/chat/messages/${conversationId}`,
      {
        params: {
          limit: 20,
        },
      },
    );

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to load messages"),
    );
  }
});

//
// SEND MESSAGE
//

export const sendMessage = createAsyncThunk<
  Message,
  FormData,
  {
    rejectValue: string;
  }
>("chat/sendMessage", async (formData, thunkAPI) => {
  try {
    const response = await API.post<Message>("/chat/send-message", formData);

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to send message"),
    );
  }
});

//
// SLICE
//

const chatSlice = createSlice({
  name: "chat",

  initialState,

  reducers: {
    setSelectedConversation: (
      state,
      action: PayloadAction<Conversation | null>,
    ) => {
      const conversationId = action.payload?._id;

      if (state.selectedConversation?._id !== conversationId) {
        state.messages = [];
        state.nextCursor = null;
        state.hasMoreMessages = false;
      }

      state.selectedConversation = action.payload;
    },

    setSelectedUser: (state, action: PayloadAction<User | null>) => {
      state.selectedUser = action.payload;
    },

    addMessage: (state, action: PayloadAction<Message>) => {
      const exists = state.messages.find(
        (message) => message._id === action.payload._id,
      );

      if (!exists) {
        state.messages.push(action.payload);
      }
    },

    clearMessages: (state) => {
      state.messages = [];
      state.nextCursor = null;
      state.hasMoreMessages = false;
    },

    resetChatError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder

      //
      // GET CONVERSATIONS
      //

      .addCase(getConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(getConversations.fulfilled, (state, action) => {
        state.loading = false;

        if (state.page === 1) {
          state.conversations = action.payload.conversations;
        } else {
          state.conversations.push(...action.payload.conversations);
        }

        state.hasMore = action.payload.hasMore;
        state.total = action.payload.total;
      })

      .addCase(getConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Error";
      })

      //
      // CREATE GROUP
      //

      .addCase(createGroup.pending, (state) => {
        state.creatingGroup = true;
        state.error = null;
      })

      .addCase(createGroup.fulfilled, (state, action) => {
        state.creatingGroup = false;

        state.conversations.unshift(action.payload);
      })

      .addCase(createGroup.rejected, (state, action) => {
        state.creatingGroup = false;

        state.error = action.payload || "Error";
      })

      //
      // GET MESSAGES
      //

      .addCase(getMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(getMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload.messages;
        state.hasMoreMessages = action.payload.hasMore;
        state.nextCursor = action.payload.nextCursor;
      })

      .addCase(getMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Error";
      })

      .addCase(loadMoreMessages.pending, (state) => {
        state.loadingMoreMessages = true;
        state.error = null;
      })

      .addCase(loadMoreMessages.fulfilled, (state, action) => {
        state.loadingMoreMessages = false;
        state.messages = [...action.payload.messages, ...state.messages];

        state.hasMoreMessages = action.payload.hasMore;
        state.nextCursor = action.payload.nextCursor;
      })

      .addCase(loadMoreMessages.rejected, (state, action) => {
        state.loadingMoreMessages = false;
        state.error = action.payload || "Error";
      })

      //
      // SEND MESSAGE
      //

      .addCase(sendMessage.pending, (state) => {
        state.sending = true;
        state.error = null;
      })

      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;

        state.messages.push(action.payload);

        const conversation = state.conversations.find(
          (conversation) => conversation._id === action.payload.conversationId,
        );

        if (conversation) {
          conversation.lastMessage = action.payload.text;

          conversation.lastMessageAt = action.payload.createdAt;
        }
      })

      .addCase(sendMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload || "Error";
      })

      //
      // CREATE CONVERSATION
      //

      .addCase(createConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(createConversation.fulfilled, (state, action) => {
        state.loading = false;

        const exists = state.conversations.find(
          (conversation) => conversation._id === action.payload._id,
        );

        if (!exists) {
          state.conversations.unshift(action.payload);
        }

        state.selectedConversation = action.payload;
      })

      .addCase(createConversation.rejected, (state, action) => {
        state.loading = false;

        state.error = action.payload || "Failed to create conversation";
      });
  },
});

export const {
  setSelectedUser,
  setSelectedConversation,
  addMessage,
  clearMessages,
  resetChatError,
} = chatSlice.actions;

export default chatSlice.reducer;
