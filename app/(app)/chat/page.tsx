import { Suspense } from "react";

import { ChatClient } from "./_components/chat-client";

// Static shell. The conversation is loaded/streamed client-side via tRPC hooks
// in <ChatClient/> (mirrors /inbox, /today). <ChatClient/> reads the URL search
// param for the active conversation, so it sits under a Suspense boundary.
export default function ChatPage() {
  return (
    <Suspense>
      <ChatClient />
    </Suspense>
  );
}
