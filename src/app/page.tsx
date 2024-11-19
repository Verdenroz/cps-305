"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSearchParams } from "next/navigation";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CryptoService } from "@/utils/crypto";

interface Message {
  senderID: string;
  recipientID: string;
  sender: string;
  text: string;
  time: string;
}

// This is sample data
const users = [
  {
    name: "Harvey",
    email: "tsenh@farmingdale.edu",
    avatar: "/avatars/harvey.jpg",
    clientID: "1",
  },
  {
    name: "Harry",
    email: "potterh@farmingdale.edu",
    avatar: "/avatars/harry.jpg",
    clientID: "2",
  },
  {
    name: "Jon",
    email: "snowj@farmingdale.edu",
    avatar: "/avatars/jon.jpg",
    clientID: "3",
  },
];

export default function Page() {
  const searchParams = useSearchParams();
  const clientID = searchParams.get("user") || users[0].clientID;
  const peerID = searchParams.get("peer") || undefined;
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState("");
  const [isInitialized, setIsInitialized] = React.useState(false);

  const [cryptoService] = React.useState(() => new CryptoService());

  React.useEffect(() => {
    const initializeSecureConnection = async () => {
      try {
        // Generate keypair
        const { privateKey, publicKey } = await cryptoService.generateKeyPair();

        // Exchange keys with server
        const response = await fetch("/api/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            clientId: clientID, 
            publicKey: publicKey
          }),
        });

        if (!response.ok) throw new Error("Key exchange failed");

        const { serverPublicKey, sessionId } = await response.json();

        // Compute shared secret
        const sharedSecret = await cryptoService.computeSharedSecret(
          privateKey,
          serverPublicKey
        );
        
        // Store in crypto service
        cryptoService.setSession(sharedSecret, sessionId);

        setIsInitialized(true);
      } catch (error: any) {
        console.error("Failed to initialize secure connection:", error);
      }
    };

    if (clientID && !isInitialized) {
      initializeSecureConnection();
    }
  }, [clientID, isInitialized, cryptoService]);

  const handleSendMessage = async () => {
    console.log("Sending message:", newMessage);
    console.log
    if (newMessage.trim() && clientID && peerID) {
      try {
        // Encrypt message
        const { encrypted, iv } = await cryptoService.encryptMessage(newMessage);
        
        // Construct the message body
        const body = {
          sender: clientID,
          encrypted,
          iv,
          session_id: cryptoService.getSessionId(),
          recipient: peerID
        };

        // Send encrypted message
        const response = await fetch("/api/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Message sent:", result);

          // Add to local state
          const newMsg = {
            senderID: clientID,
            recipientID: peerID,
            sender: users.find((user) => user.clientID === clientID)?.name || "You",
            text: newMessage,
            time: new Date().toLocaleString(),
          };
          setMessages([...messages, newMsg]);
          setNewMessage("");
        } else {
          console.error("Failed to send message:", response.statusText);
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "350px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen">
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">All Inboxes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Inbox</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto p-4">
          {messages
            .filter(
              (message) =>
                (message.senderID === peerID &&
                  message.recipientID === clientID) ||
                (message.senderID === clientID &&
                  message.recipientID === peerID)
            )
            .map((message, index) => (
              <div
                key={index}
                className={`border p-2 rounded-md mb-2 ${
                  message.senderID === clientID
                    ? "bg-blue-100 ml-auto"
                    : "bg-gray-100"
                }`}
                style={{ maxWidth: "70%" }}
              >
                <p>
                  <strong>{message.sender}</strong>
                </p>
                <p>{message.text}</p>
                <p className="text-xs text-gray-500">{message.time}</p>
              </div>
            ))}
        </div>
        <div className="p-4 border-t flex">
          <Input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-grow mr-2"
          />
          <Button onClick={handleSendMessage} >Send</Button>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
