import { Message } from "@/types/chat";
import { useEffect, useRef } from "react";

export const useChatScroll = (
  messages: Message[],
  selectedConversationId?: string,
) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const isNearBottom = () => {
    const container = containerRef.current;

    if (!container) return false;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceFromBottom < 150;
  };

  const scrollToBottom = () => {
    const container = containerRef.current;

    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "auto",
    });
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (isNearBottom()) {
        scrollToBottom();
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [selectedConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversationId, messages.length]);

  return {
    containerRef,
    scrollToBottom,
  };
};
