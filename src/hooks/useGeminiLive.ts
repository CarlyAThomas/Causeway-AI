'use client';

import { useState, useRef, useCallback } from 'react';

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false); // <--- NEW: Track safe streaming state
  const [messages, setMessages] = useState<string[]>([]); 
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((apiKey: string) => {
    if (!apiKey) {
      console.error("No API key provided for Gemini Live");
      setMessages(prev => [...prev, "System: Error - No API Key provided."]);
      return;
    }
    
    // The Multimodal Live API requires the model name in the URL connecting to the websocket endpoint:
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      setMessages(prev => [...prev, "System: Connected to Gemini Live. Sending Setup..."]);
      
      // Step 1: Send Setup Payload
      const setupMessage = {
        setup: {
          model: "models/gemini-3.0-flash-preview",
          generationConfig: {
            responseModalities: ["TEXT"] // Force text output so we don't accidentally receive raw audio blocks causing a crash
          },
          systemInstruction: {
            parts: [{ text: "You are a physical task assistant. Watch the video feed and guide the user step by step safely. Keep instructions short and concise." }]
          }
        }
      };
      
      console.log("🟢 OUTGOING [Setup]:", JSON.stringify(setupMessage, null, 2));
      ws.send(JSON.stringify(setupMessage));
    };

    ws.onmessage = async (event) => {
      try {
        let textData = event.data;
        if (event.data instanceof Blob) {
          textData = await event.data.text();
        }
        
        const response = JSON.parse(textData);
        console.log("🔵 INCOMING:", JSON.stringify(response, null, 2)); // EXPLICIT DEBUG LOG
        
        // Handle Setup Complete
        if (response.setupComplete) {
          setIsSetupComplete(true); // <--- We are now officially allowed to send frames
          setMessages(prev => [...prev, "System: Setup complete. Initializing frame stream..."]);
          
          // CRITICAL: The model expects us to explicitly tell it we're starting a message turn
          // so it starts listening to the incoming media chunks.
          const clientContentMsg = {
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [{ text: "Hello! I am ready to start my task. Are you receiving my video feed?" }]
                }
              ],
              turnComplete: true
            }
          };
          console.log("🟢 OUTGOING [ClientContent]:", JSON.stringify(clientContentMsg, null, 2));
          ws.send(JSON.stringify(clientContentMsg));
        }

        // Handle errors from server
        if (response.error) {
          console.error("Gemini Server Error:", response.error);
          setMessages(prev => [...prev, `System: API Error - ${response.error.message || 'Unknown'}`]);
        }
        
        // Handle Server Content (Text or Audio)
        if (response.serverContent && response.serverContent.modelTurn) {
          const parts = response.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.text) {
              setMessages(prev => [...prev, `Gemini: ${part.text}`]);
            }
          }
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      setIsSetupComplete(false);
      console.warn(`WebSocket Closed: Code ${event.code}, Reason: "${event.reason}"`); // DEBUG LOG
      setMessages(prev => [...prev, `System: Disconnected (Code: ${event.code} ${event.reason ? '- ' + event.reason : ''})`]);
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error Object:", err); // DEBUG LOG
      setMessages(prev => [...prev, "System: WebSocket connection error. Check console."]);
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  // Send a base64 encoded JPEG frame
  const sendFrame = useCallback((base64Jpeg: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !isSetupComplete) return;
    
    // Strip the data:image/jpeg;base64, prefix if present
    const cleanBase64 = base64Jpeg.replace(/^data:image\/jpeg;base64,/, '');

    const msg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        ]
      }
    };
    
    // VERY verbose frame logging - we'll only log that we sent it rather than the huge base64 payload to prevent console freezing
    console.log("🟢 OUTGOING [RealtimeInput]: Frame sent (Length: " + cleanBase64.length + " bytes)"); 
    wsRef.current.send(JSON.stringify(msg));
  }, [isSetupComplete]);

  return { isConnected, isSetupComplete, connect, disconnect, sendFrame, messages };
}
