"use client"

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useSearchParams } from "next/navigation"
import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  }
]

export default function Page() {
  const searchParams = useSearchParams()
  const clientID = searchParams.get("user") || users[0].clientID
  const peerID = searchParams.get("peer") || undefined;
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState("");

  React.useEffect(() => {
    const fetchMessages = async () => {
      if (clientID) {
        const response = await fetch(`/api/messages/${clientID}`);
        if (response.ok) {
          const data = await response.json();
          const decryptedMessages: Message[] = await Promise.all(
            data.map(async (message: any) => {
              const iv = Uint8Array.from(atob(message.message.iv), c => c.charCodeAt(0));
              const ciphertext = Uint8Array.from(atob(message.message.ciphertext), c => c.charCodeAt(0));
              const sharedKey = Uint8Array.from(atob(message.message.shared_key), c => c.charCodeAt(0));

              const key = await crypto.subtle.importKey(
                "raw",
                sharedKey,
                { name: "AES-CBC" },
                false,
                ["decrypt"]
              );

              const decrypted = await crypto.subtle.decrypt(
                { name: "AES-CBC", iv: iv },
                key,
                ciphertext
              );

              const decryptedMessage = new TextDecoder().decode(decrypted);

              // Verify integrity using the hash
              const encoder = new TextEncoder();
              const data = encoder.encode(decryptedMessage);
              const hashBuffer = await crypto.subtle.digest("SHA-256", data);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

              if (hashHex !== message.message.hash) {
                console.error('Message integrity check failed');
                return {
                  senderID: message.sender,
                  recipientID: message.recipient,
                  sender: message.sender,
                  text: 'Message integrity check failed',
                  time: new Date(message.timestamp * 1000).toLocaleString()
                };
              }

              return {
                senderID: message.sender,
                recipientID: message.recipient,
                sender: users.find(user => user.clientID === message.sender)?.name || message.sender,
                text: decryptedMessage,
                time: new Date(message.timestamp * 1000).toLocaleString()
              };
            })
          );
          console.log(decryptedMessages);
          setMessages(decryptedMessages);
        } else {
          console.error(`Failed to fetch messages: ${response.statusText}`);
        }
      }
    };

    fetchMessages();
  }, [clientID]);

  const handleSendMessage = async () => {
    if (newMessage.trim() && clientID && peerID) {
      // Construct the JSON body
      const body = {
        sender: clientID,
        content: {
          recipient: peerID,
          message: newMessage
        }
      };

      // Send the JSON body to the backend
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Message sent:', result);

        // Add the new message to the local state
        const newMsg: Message = {
          senderID: clientID,
          recipientID: peerID,
          sender: users.find(user => user.clientID === clientID)?.name || 'You',
          text: newMessage,
          time: new Date().toLocaleString()
        };
        setMessages([...messages, newMsg]);
        setNewMessage("");
      } else {
        console.error('Failed to send message:', response.statusText);
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
             .filter(message => 
              (message.senderID === peerID && message.recipientID === clientID) ||
              (message.senderID === clientID && message.recipientID === peerID)
            )
            .map((message, index) => (
              <div key={index} className={`border p-2 rounded-md mb-2 ${message.senderID === clientID ? 'bg-blue-100 ml-auto' : 'bg-gray-100'}`} style={{maxWidth: '70%'}}>
                <p><strong>{message.sender}</strong></p>
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
          <Button onClick={handleSendMessage}>Send</Button>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
