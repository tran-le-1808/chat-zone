import { User } from "@/redux/features/authSlice";

export interface ParticipantSetting {
  userId: string;

  unreadCount: number;

  pinned: boolean;

  muted: boolean;

  hidden: boolean;

  deleted: boolean;

  blocked: boolean;

  lastSeenAt: string | null;
}

export interface Conversation {
  _id: string;

  participants: User[];

  participantsSettings: ParticipantSetting[];

  isGroup: boolean;

  groupName?: string;

  groupAvatar?: string;

  lastMessage: string;

  lastMessageAt: string;

  unreadCount?: number;
}

export interface Attachment {
  url: string;

  name: string;

  type: string;

  size: number;
}

export interface ReplyPreview {
  messageId: string;
  senderId: string;
  text: string;
  type: string;
  attachments: { name: string; type: string; url?: string }[];
  /** Tin gốc đã thu hồi (hoặc tôi đã xoá ở phía mình): không hiện nội dung */
  unavailable: boolean;
}

export interface Message {
  _id: string;

  conversationId: string;

  senderId: string;

  text: string;

  type: string;

  attachments: Attachment[];

  seen: boolean;

  createdAt: string;

  /** Tin được trả lời (id) và bản xem trước gọn do máy chủ trả kèm */
  replyTo?: string | null;
  replyPreview?: ReplyPreview | null;

  /** Số thứ tự trong hội thoại (do máy chủ cấp) */
  seq?: number | null;

  /** Đã chỉnh sửa lúc … / đã bị thu hồi với mọi người (nội dung đã xoá thật) */
  editedAt?: string | null;
  recalledAt?: string | null;
  recalledBy?: string | null;

  /** Chỉ ở phía client: tin vừa gửi đang chờ máy chủ ("sending") hoặc gửi lỗi ("failed") */
  clientStatus?: "sending" | "failed";

  /** Khoá ổn định của tin gửi đi (giữ nguyên khi tin tạm được thay bằng tin của máy chủ) */
  clientId?: string;
}

export interface GetMessagesResponse {
  messages: Message[];
  hasMore: boolean;
  /** Đang xem cửa sổ giữa lịch sử (sau khi nhảy tới một tin): còn tin mới hơn */
  hasNewer?: boolean;
  nextCursor: string | null;
}

export interface ConversationsResponse {
  conversations: Conversation[];

  total: number;

  hasMore: boolean;
}

export interface GetConversationsPayload {
  userId: string;

  page?: number;

  limit?: number;

  search?: string;
}

export enum MessageType {
  TEXT = "TEXT",

  IMAGE = "IMAGE",

  FILE = "FILE",

  VIDEO = "VIDEO",

  MIXED = "MIXED",
}
