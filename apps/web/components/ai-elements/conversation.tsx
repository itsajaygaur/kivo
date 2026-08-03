"use client";

import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";
import { useCallback, type ComponentProps } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export function Conversation({ className, ...props }: ConversationProps) {
  return (
    <StickToBottom
      className={cn("chat-scroll", className)}
      initial="smooth"
      resize="smooth"
      role="log"
      {...props}
    />
  );
}

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export function ConversationContent({
  className,
  scrollClassName,
  ...props
}: ConversationContentProps) {
  return (
    <StickToBottom.Content
      className={className}
      scrollClassName={cn("chat-scroll-viewport", scrollClassName)}
      {...props}
    />
  );
}

export type ConversationScrollButtonProps = ComponentProps<"button">;

export function ConversationScrollButton({ className, ...props }: ConversationScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const handleClick = useCallback(() => scrollToBottom(), [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <button
      type="button"
      className={cn("chat-scroll-button", className)}
      onClick={handleClick}
      {...props}
    >
      <ArrowDown size={16} />
    </button>
  );
}
