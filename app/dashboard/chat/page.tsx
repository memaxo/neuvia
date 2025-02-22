"use client";

import React from "react";

import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function ChatPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          Ask about patient details or report insights…
        </li>
      </ul>
    </GuideInfoBox>
  );

  return (
    <ChatWindow
      emptyStateComponent={InfoCard}
      endpoint="/api/chat/rag"
      placeholder="Ask about patient details or report insights…"
      showIntermediateStepsToggle={true}
    />
  );
}