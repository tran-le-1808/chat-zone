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

export interface Message {
  _id: string;

  conversationId: string;

  senderId: string;

  text: string;

  type: string;

  attachments: Attachment[];

  seen: boolean;

  createdAt: string;
}

export interface GetMessagesResponse {
  messages: Message[];
  hasMore: boolean;
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
