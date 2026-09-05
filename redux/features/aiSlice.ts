import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import API from "@/lib/api";
import { getApiErrorMessage } from "@/lib/get-api-error";
import { Attachment } from "@/types/chat";

/**
 * =========================================================
 * TYPES
 * =========================================================
 */

export interface AIConversation {
  _id: string;
  title?: string;
  participants?: string[];
  lastMessage?: string;
  lastMessageAt?: string | null;
  provider?: string;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type?: string;
  attachments: Attachment[];
  seen?: boolean;
  deleted?: boolean;
  replyTo?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AIConversationsResponse {
  conversations: AIConversation[];
  total?: number;
  hasMore?: boolean;
}

export interface AIMessagesResponse {
  messages: AIMessage[];
  hasMore?: boolean;
  nextCursor?: string | null;
}

export interface CreateAIConversationPayload {
  title?: string;
  provider?: string;
  model?: string;
}

export interface SendAIMessagePayload {
  conversationId: string;
  content: string;
}

export interface LoadMoreAIMessagesPayload {
  conversationId: string;
  before: string;
}

export interface SendAIMessageResponse {
  userMessage: AIMessage;
  aiMessage: AIMessage;
}
/**
 * =========================================================
 * STATE
 * =========================================================
 */

interface AIState {
  conversations: AIConversation[];
  messages: AIMessage[];
  selectedConversation: AIConversation | null;
  loading: boolean;
  creatingConversation: boolean;
  sending: boolean;
  streaming: boolean;
  loadingMoreMessages: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  hasMoreMessages: boolean;
  streamingMessage: string;
  streamingConversationId: string | null;
}

const initialState: AIState = {
  conversations: [],
  messages: [],
  selectedConversation: null,
  loading: false,
  creatingConversation: false,
  sending: false,
  streaming: false,
  loadingMoreMessages: false,
  error: null,
  total: 0,
  hasMore: false,
  nextCursor: null,
  hasMoreMessages: false,
  streamingMessage: "",
  streamingConversationId: null,
};

/**
 * =========================================================
 * GET CONVERSATIONS
 * GET /ai/conversations
 * =========================================================
 */

export const getAIConversations = createAsyncThunk<
  AIConversationsResponse,
  void,
  {
    rejectValue: string;
  }
>("ai/getConversations", async (_, thunkAPI) => {
  try {
    const response = await API.get<AIConversationsResponse | AIConversation[]>(
      "/ai/conversations",
    );

    // Normalize payload in case backend returns array directly
    if (Array.isArray(response.data)) {
      return {
        conversations: response.data,
        total: response.data.length,
        hasMore: false,
      };
    }

    return {
      conversations: response.data.conversations ?? [],
      total: response.data.total ?? response.data.conversations?.length ?? 0,
      hasMore: response.data.hasMore ?? false,
    };
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to load AI conversations"),
    );
  }
});

/**
 * =========================================================
 * CREATE CONVERSATION
 * POST /ai/conversations
 * =========================================================
 */

export const createAIConversation = createAsyncThunk<
  AIConversation,
  CreateAIConversationPayload,
  {
    rejectValue: string;
  }
>("ai/createConversation", async (data, thunkAPI) => {
  try {
    const response = await API.post<AIConversation>("/ai/conversations", data);
    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to create AI conversation"),
    );
  }
});

/**
 * =========================================================
 * GET MESSAGES
 * GET /ai/conversations/:conversationId/messages
 * =========================================================
 */

export const getAIMessages = createAsyncThunk<
  AIMessagesResponse,
  string,
  {
    rejectValue: string;
  }
>("ai/getMessages", async (conversationId, thunkAPI) => {
  try {
    const response = await API.get<AIMessagesResponse>(
      `/ai/conversations/${conversationId}/messages`,
    );
    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to load AI messages"),
    );
  }
});

/**
 * =========================================================
 * SEND MESSAGE
 * POST /ai/conversations/:conversationId/messages
 * =========================================================
 */

export const sendAIMessage = createAsyncThunk<
  SendAIMessageResponse, // Type dữ liệu trả về khi fulfilled
  SendAIMessagePayload, // Type dữ liệu truyền vào payload
  {
    rejectValue: string;
  }
>("ai/sendMessage", async ({ conversationId, content }, thunkAPI) => {
  try {
    const response = await API.post<SendAIMessageResponse>(
      `/ai/conversations/${conversationId}/messages`,
      { content },
    );
    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to send AI message"),
    );
  }
});

/**
 * =========================================================
 * LOAD MORE MESSAGES
 * =========================================================
 */

export const loadMoreAIMessages = createAsyncThunk<
  AIMessagesResponse,
  LoadMoreAIMessagesPayload,
  {
    rejectValue: string;
  }
>("ai/loadMoreMessages", async ({ conversationId, before }, thunkAPI) => {
  try {
    const response = await API.get<AIMessagesResponse>(
      `/ai/conversations/${conversationId}/messages`,
      {
        params: {
          before,
          limit: 20,
        },
      },
    );
    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to load more AI messages"),
    );
  }
});

/**
 * =========================================================
 * SLICE
 * =========================================================
 */

const aiSlice = createSlice({
  name: "ai",
  initialState,
  reducers: {
    setSelectedAIConversation: (
      state,
      action: PayloadAction<AIConversation | null>,
    ) => {
      const conversationId = action.payload?._id;

      if (state.selectedConversation?._id !== conversationId) {
        state.messages = [];
        state.nextCursor = null;
        state.hasMoreMessages = false;
        state.streamingMessage = "";
        state.streaming = false;
        state.streamingConversationId = null;
      }

      state.selectedConversation = action.payload;
    },

    addAIMessage: (state, action: PayloadAction<AIMessage>) => {
      const exists = state.messages.some(
        (message) => message._id === action.payload._id,
      );

      if (!exists) {
        state.messages.push(action.payload);
      }
    },

    clearAIMessages: (state) => {
      state.messages = [];
      state.nextCursor = null;
      state.hasMoreMessages = false;
      state.streamingMessage = "";
      state.streaming = false;
      state.streamingConversationId = null;
    },

    resetAIError: (state) => {
      state.error = null;
    },

    aiMessageStart: (
      state,
      action: PayloadAction<{ conversationId: string }>,
    ) => {
      state.streaming = true;
      state.sending = true;
      state.streamingMessage = "";
      state.streamingConversationId = action.payload.conversationId;
      state.error = null;
    },

    aiMessageChunk: (
      state,
      action: PayloadAction<{ conversationId: string; chunk: string }>,
    ) => {
      if (state.streamingConversationId !== action.payload.conversationId) {
        return;
      }
      state.streamingMessage += action.payload.chunk;
    },

    aiMessageComplete: (
      state,
      action: PayloadAction<{
        conversationId: string;
        message?: AIMessage;
      }>,
    ) => {
      if (state.streamingConversationId !== action.payload.conversationId) {
        return;
      }

      state.streaming = false;
      state.sending = false;

      if (action.payload.message) {
        const exists = state.messages.some(
          (message) => message._id === action.payload.message?._id,
        );

        if (!exists) {
          state.messages.push(action.payload.message);
        }
      }

      state.streamingMessage = "";
      state.streamingConversationId = null;
    },

    aiMessageError: (
      state,
      action: PayloadAction<{
        conversationId?: string;
        message: string;
      }>,
    ) => {
      state.streaming = false;
      state.sending = false;
      state.error = action.payload.message;
      state.streamingMessage = "";
      state.streamingConversationId = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(getAIConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAIConversations.fulfilled, (state, action) => {
        state.loading = false;
        const conversations = action.payload?.conversations ?? [];
        state.conversations = conversations;
        state.total = action.payload?.total ?? conversations.length;
        state.hasMore = action.payload?.hasMore ?? false;
      })
      .addCase(getAIConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load AI conversations";
      })

      .addCase(createAIConversation.pending, (state) => {
        state.creatingConversation = true;
        state.error = null;
      })
      .addCase(createAIConversation.fulfilled, (state, action) => {
        state.creatingConversation = false;
        const exists = state.conversations.some(
          (conversation) => conversation._id === action.payload._id,
        );

        if (!exists) {
          state.conversations.unshift(action.payload);
        }

        state.selectedConversation = action.payload;
        state.messages = [];
        state.nextCursor = null;
        state.hasMoreMessages = false;
        state.streamingMessage = "";
        state.streaming = false;
        state.streamingConversationId = null;
      })
      .addCase(createAIConversation.rejected, (state, action) => {
        state.creatingConversation = false;
        state.error = action.payload || "Failed to create AI conversation";
      })

      .addCase(getAIMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAIMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload?.messages ?? [];
        state.hasMoreMessages = action.payload?.hasMore ?? false;
        state.nextCursor = action.payload?.nextCursor ?? null;
      })
      .addCase(getAIMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load AI messages";
      })

      .addCase(sendAIMessage.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendAIMessage.fulfilled, (state, action) => {
        state.sending = false;

        const { userMessage, aiMessage } = action.payload;

        // Push userMessage vào state nếu chưa có
        if (
          userMessage &&
          !state.messages.some((m) => m._id === userMessage._id)
        ) {
          state.messages.push(userMessage);
        }

        // Push aiMessage vào state nếu chưa có
        if (aiMessage && !state.messages.some((m) => m._id === aiMessage._id)) {
          state.messages.push(aiMessage);
        }

        // Cập nhật conversation
        const conversation = state.conversations.find(
          (item) => item._id === action.payload.aiMessage?.conversationId,
        );

        if (conversation && aiMessage) {
          conversation.lastMessage = aiMessage.text;
          conversation.lastMessageAt = aiMessage.createdAt;
        }
      })
      .addCase(sendAIMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload || "Failed to send AI message";
      })

      .addCase(loadMoreAIMessages.pending, (state) => {
        state.loadingMoreMessages = true;
        state.error = null;
      })
      .addCase(loadMoreAIMessages.fulfilled, (state, action) => {
        state.loadingMoreMessages = false;
        const newMessages = action.payload?.messages ?? [];
        state.messages = [...newMessages, ...state.messages];
        state.hasMoreMessages = action.payload?.hasMore ?? false;
        state.nextCursor = action.payload?.nextCursor ?? null;
      })
      .addCase(loadMoreAIMessages.rejected, (state, action) => {
        state.loadingMoreMessages = false;
        state.error = action.payload || "Failed to load more AI messages";
      });
  },
});

export const {
  setSelectedAIConversation,
  addAIMessage,
  clearAIMessages,
  resetAIError,
  aiMessageStart,
  aiMessageChunk,
  aiMessageComplete,
  aiMessageError,
} = aiSlice.actions;

export default aiSlice.reducer;
