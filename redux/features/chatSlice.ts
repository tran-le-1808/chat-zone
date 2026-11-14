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
  adminId: string;
  groupName: string;
  participants: string[];
  groupAvatar?: string;
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
  /** Đang xem cửa sổ giữa lịch sử (sau khi nhảy tới 1 tin): còn tin mới hơn chưa nạp */
  hasNewerMessages: boolean;
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
  hasNewerMessages: false,
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
>("chat/createGroup", async (payload, thunkAPI) => {
  try {
    const response = await API.post<Conversation>(
      "/chat/create-group",
      payload,
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

/** FormData của các tin đang gửi / gửi lỗi (không serialize được nên để ngoài Redux) -> dùng để gửi lại */
const pendingForms = new Map<string, FormData>();
export const getPendingForm = (tempId: string) => pendingForms.get(tempId);
export const rememberPendingForm = (tempId: string, form: FormData) =>
  void pendingForms.set(tempId, form);

export interface SendMessageArg {
  formData: FormData;
  /** Id tạm của tin đã được đẩy lên cuộc hội thoại (hiển thị ngay, chờ máy chủ xác nhận) */
  tempId: string;
}

export const sendMessage = createAsyncThunk<
  Message,
  SendMessageArg,
  {
    rejectValue: string;
  }
>("chat/sendMessage", async ({ formData, tempId }, thunkAPI) => {
  try {
    const response = await API.post<Message>("/chat/send-message", formData);
    pendingForms.delete(tempId);

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Failed to send message"),
    );
  }
});

//
// SỬA / XOÁ / THU HỒI / NHẢY TỚI TIN
//

export const editMessageRequest = createAsyncThunk<
  { messageId: string; text: string; editedAt: string },
  { messageId: string; text: string },
  { rejectValue: string }
>("chat/editMessage", async ({ messageId, text }, thunkAPI) => {
  try {
    const res = await API.patch(`/chat/messages/${messageId}`, { text });
    return res.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Không thể chỉnh sửa tin nhắn"),
    );
  }
});

/** scope "me" = xoá ở phía tôi · "all" = thu hồi với mọi người */
export const deleteMessageRequest = createAsyncThunk<
  {
    messageId: string;
    scope: "me" | "all";
    recalledAt?: string;
    recalledBy?: string;
  },
  { messageId: string; scope: "me" | "all" },
  { rejectValue: string }
>("chat/deleteMessage", async ({ messageId, scope }, thunkAPI) => {
  try {
    const res = await API.delete(`/chat/messages/${messageId}`, {
      params: { scope },
    });
    return { ...res.data, messageId, scope };
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(
      getApiErrorMessage(error, "Không thể xoá tin nhắn"),
    );
  }
});

/** Nạp cửa sổ tin quanh một tin (nhảy tới kết quả tìm kiếm / tin được trả lời) */
export const loadMessagesAround = createAsyncThunk<
  GetMessagesResponse,
  { conversationId: string; messageId: string },
  { rejectValue: string }
>(
  "chat/loadMessagesAround",
  async ({ conversationId, messageId }, thunkAPI) => {
    try {
      const res = await API.get<GetMessagesResponse>(
        `/chat/messages/${conversationId}`,
        { params: { around: messageId, limit: 40 } },
      );
      return res.data;
    } catch (error: unknown) {
      return thunkAPI.rejectWithValue(
        getApiErrorMessage(error, "Không tìm thấy tin nhắn"),
      );
    }
  },
);

/** Cập nhật tin sau khi sửa (+ bản xem trước trong các tin trả lời nó) */
function applyEdited(
  state: ChatState,
  p: { messageId: string; text: string; editedAt: string },
) {
  for (const m of state.messages) {
    if (m._id === p.messageId) {
      m.text = p.text;
      m.editedAt = p.editedAt;
    }
    if (m.replyPreview && m.replyPreview.messageId === p.messageId) {
      m.replyPreview.text = p.text
        .split("\n")
        .slice(0, 2)
        .join("\n")
        .slice(0, 120);
    }
  }
}

/** Thu hồi: xoá nội dung phía client, các trích dẫn tới nó chuyển sang "đã thu hồi" */
function applyRecalled(
  state: ChatState,
  p: { messageId: string; recalledAt?: string; recalledBy?: string },
) {
  for (const m of state.messages) {
    if (m._id === p.messageId) {
      m.text = "";
      m.attachments = [];
      m.recalledAt = p.recalledAt ?? new Date().toISOString();
      m.recalledBy = p.recalledBy ?? m.senderId;
      m.editedAt = null;
      delete m.clientStatus;
    }
    if (m.replyPreview && m.replyPreview.messageId === p.messageId) {
      m.replyPreview = {
        ...m.replyPreview,
        text: "",
        attachments: [],
        unavailable: true,
      };
    }
  }
}

//
// SLICE
//

const chatSlice = createSlice({
  name: "chat",

  initialState,

  reducers: {
    updateConversationFromSocket: (
      state,
      action: PayloadAction<{
        conversationId: string;
        lastMessage: string;
        lastMessageAt: string;
      }>,
    ) => {
      const { conversationId, lastMessage, lastMessageAt } = action.payload;
      const index = state.conversations.findIndex(
        (c) => c._id === conversationId,
      );

      if (index !== -1) {
        const updatedConv = {
          ...state.conversations[index],
          lastMessage,
          lastMessageAt,
        };
        state.conversations.splice(index, 1);
        state.conversations.unshift(updatedConv);
      }
    },

    addConversationFromSocket: (state, action: PayloadAction<Conversation>) => {
      const exists = state.conversations.some(
        (c) => c._id === action.payload._id,
      );
      if (!exists) {
        state.conversations.unshift(action.payload);
      }
    },
    setSelectedConversation: (
      state,
      action: PayloadAction<Conversation | null>,
    ) => {
      const conversationId = action.payload?._id;

      if (state.selectedConversation?._id !== conversationId) {
        state.messages = [];
        state.nextCursor = null;
        state.hasMoreMessages = false;
        state.hasNewerMessages = false;
      }

      state.selectedConversation = action.payload;
    },

    setSelectedUser: (state, action: PayloadAction<User | null>) => {
      state.selectedUser = action.payload;
    },

    /** Đẩy tin vừa soạn vào cuộc hội thoại NGAY (trạng thái đang gửi), trước khi máy chủ phản hồi */
    addPendingMessage: (state, action: PayloadAction<Message>) => {
      const msg = action.payload;
      state.messages.push(msg);
      const idx = state.conversations.findIndex(
        (c) => c._id === msg.conversationId,
      );
      if (idx !== -1) {
        const conv = {
          ...state.conversations[idx],
          lastMessage: msg.text || state.conversations[idx].lastMessage,
          lastMessageAt: msg.createdAt,
        };
        state.conversations.splice(idx, 1);
        state.conversations.unshift(conv);
      }
    },

    /** Bỏ một tin gửi lỗi (người dùng huỷ) */
    removePendingMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((m) => m._id !== action.payload);
      pendingForms.delete(action.payload);
    },

    addMessage: (state, action: PayloadAction<Message>) => {
      const exists = state.messages.find(
        (message) => message._id === action.payload._id,
      );

      if (!exists) {
        state.messages.push(action.payload);
      }
    },

    /** Sự kiện realtime: tin được chỉnh sửa */
    messageEdited: (
      state,
      action: PayloadAction<{
        messageId: string;
        text: string;
        editedAt: string;
      }>,
    ) => {
      applyEdited(state, action.payload);
    },

    /** Sự kiện realtime: tin bị thu hồi */
    messageRecalled: (
      state,
      action: PayloadAction<{
        messageId: string;
        recalledAt?: string;
        recalledBy?: string;
      }>,
    ) => {
      applyRecalled(state, action.payload);
    },

    /** "Xoá ở phía tôi" (từ thiết bị khác của tôi): gỡ tin khỏi danh sách */
    messageRemoved: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((m) => m._id !== action.payload);
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

      // Phản hồi của hội thoại KHÁC hội thoại đang chọn (người dùng đã bấm sang hội thoại khác
      // trong lúc chờ mạng) bị bỏ qua -> không ghi đè tin nhắn của hội thoại đang mở.
      .addCase(getMessages.pending, (state, action) => {
        if (action.meta.arg !== state.selectedConversation?._id) return;
        state.loading = true;
        state.error = null;
      })

      .addCase(getMessages.fulfilled, (state, action) => {
        if (action.meta.arg !== state.selectedConversation?._id) return;
        state.loading = false;
        state.messages = action.payload.messages;
        state.hasMoreMessages = action.payload.hasMore;
        state.nextCursor = action.payload.nextCursor;
        state.hasNewerMessages = false;
      })

      .addCase(getMessages.rejected, (state, action) => {
        if (action.meta.arg !== state.selectedConversation?._id) return;
        state.loading = false;
        state.error = action.payload || "Error";
      })

      .addCase(loadMoreMessages.pending, (state) => {
        state.loadingMoreMessages = true;
        state.error = null;
      })

      .addCase(loadMoreMessages.fulfilled, (state, action) => {
        state.loadingMoreMessages = false;
        if (action.meta.arg.conversationId !== state.selectedConversation?._id)
          return;
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

      .addCase(sendMessage.pending, (state, action) => {
        state.sending = true;
        state.error = null;
        // Gửi lại: tin đang ở trạng thái lỗi -> quay về "đang gửi"
        const temp = state.messages.find(
          (m) => m._id === action.meta.arg.tempId,
        );
        if (temp) temp.clientStatus = "sending";
      })

      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;
        const tempId = action.meta.arg.tempId;
        const tempIdx = state.messages.findIndex((m) => m._id === tempId);
        const saved: Message = {
          ...action.payload,
          clientId: tempId,
          // Máy chủ cũ / thiếu bản xem trước: giữ trích dẫn đã hiện ở tin tạm
          replyPreview:
            action.payload.replyPreview ??
            (tempIdx !== -1 ? state.messages[tempIdx].replyPreview : null),
        };
        if (tempIdx !== -1) {
          // Thay tin tạm bằng tin máy chủ (giữ nguyên vị trí & khoá hiển thị)
          state.messages[tempIdx] = saved;
        } else if (
          state.selectedConversation?._id === saved.conversationId &&
          !state.messages.some((m) => m._id === saved._id)
        ) {
          state.messages.push(saved);
        }

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
        // Báo lỗi ngay trên tin đó (icon nhỏ bên phải) thay vì chỉ lưu lỗi chung
        const temp = state.messages.find(
          (m) => m._id === action.meta.arg.tempId,
        );
        if (temp) temp.clientStatus = "failed";
      })

      .addCase(editMessageRequest.fulfilled, (state, action) => {
        applyEdited(state, action.payload);
      })

      .addCase(deleteMessageRequest.fulfilled, (state, action) => {
        const p = action.payload;
        if (p.scope === "me") {
          state.messages = state.messages.filter((m) => m._id !== p.messageId);
        } else {
          applyRecalled(state, p);
        }
      })

      .addCase(loadMessagesAround.fulfilled, (state, action) => {
        state.messages = action.payload.messages;
        state.hasMoreMessages = action.payload.hasMore;
        state.nextCursor = action.payload.nextCursor;
        state.hasNewerMessages = !!action.payload.hasNewer;
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
  addPendingMessage,
  removePendingMessage,
  messageEdited,
  messageRecalled,
  messageRemoved,
  clearMessages,
  resetChatError,
  updateConversationFromSocket,
  addConversationFromSocket,
} = chatSlice.actions;

export default chatSlice.reducer;
