'use client';

import { useState, useRef, useCallback } from 'react';

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false); // <--- NEW: Track safe streaming state
  const [messages, setMessages] = useState<string[]>([]); 
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isVideoGenerating, setIsVideoGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  
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
          model: "models/gemini-3.1-flash-live-preview",
          generationConfig: {
            responseModalities: ["TEXT"] // Force text output so we don't accidentally receive raw audio blocks causing a crash
          },
          systemInstruction: {
            parts: [{ text: "You are a physical task assistant. Watch the video feed and guide the user step by step safely. Keep instructions short and concise. If the user needs a complex visual demonstration, use the available tools to generate a video for them. When you use a video generation tool, explicitly say 'I am generating a video for you now, it will appear on your screen shortly, but it may take a few minutes.' Do NOT mention the Veo app or say you are unable to send videos directly." }]
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "generate_text_to_video",
                  description: "Use this when the user needs a visual demonstration of a concept, or asks how to do something, and you want to show them a generated video of the action.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      prompt: {
                        type: "STRING",
                        description: "A highly descriptive, visual-focused prompt instructing the video generation model exactly what to render. (e.g. 'Show a person turning a lug wrench counter-clockwise')."
                      }
                    },
                    required: ["prompt"]
                  }
                },
                {
                  name: "generate_image_to_video",
                  description: "Use this when the user asks what to do with a specific object currently shown on their camera. This generates a video showing an action contextually starting from their current real-world state.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      prompt: {
                        type: "STRING",
                        description: "A highly descriptive action prompt explaining what should happen to the object in the user's current camera frame."
                      }
                    },
                    required: ["prompt"]
                  }
                }
              ]
            }
          ]
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
        if (response.serverContent?.modelTurn?.parts) {
          const parts = response.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.text) {
              setMessages(prev => [...prev, `Gemini: ${part.text}`]);
            }
          }
        }
        
        // Handle incoming function declarations/tool calls
        if (response.toolCall) {
          const functionCalls = response.toolCall.functionCalls;
          for (const call of functionCalls) {
            console.log(`🟡 TOOL TRIGGERED: ${call.name}`, call.args);
            setMessages(prev => [...prev, `System: 🎬 Generating video... (${call.name}: ${call.args.prompt})`]);
            setIsVideoGenerating(true);
            setGenerationProgress("Initiating video generation...");
            setGeneratedVideoUrl(null);
            
            // NOTE: Here is where we will hook up our backend route to trigger Veo
            // Fire and forget the tool call in background
            fetch('/api/generate-video', { 
                method: 'POST', 
                body: JSON.stringify(call.args),
                headers: { 'Content-Type': 'application/json' }
            }).then(async (res) => {
              if (res.ok) {
                 const data = await res.json();
                 if (data.operationName) {
                    setGenerationProgress("Video generation started. Waiting for completion... (This often takes 1-3 minutes)");
                    
                    // Start Polling 
                    let attempts = 0;
                    const pollInterval = setInterval(async () => {
                      attempts++;
                      const pollRes = await fetch('/api/poll-video', {
                        method: 'POST',
                        body: JSON.stringify({ operationName: data.operationName }),
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      if (pollRes.ok) {
                         const pollData = await pollRes.json();
                         if (pollData.done) {
                            clearInterval(pollInterval);
                            setIsVideoGenerating(false);
                            setGenerationProgress("Video Generation Complete!");
                            
                            // The response often returns response.generatedVideo.uri 
                            if (pollData.data?.response?.generatedVideo?.uri) {
                               setGeneratedVideoUrl(pollData.data.response.generatedVideo.uri);
                            } else if (pollData.data?.response?.videoUri) {
                               setGeneratedVideoUrl(pollData.data.response.videoUri);
                            } else {
                               // Fallback if structure changes
                               setGeneratedVideoUrl("https://storage.googleapis.com/");
                               console.log("Could not find video URI in generation response:", pollData.data);
                            }
                         }
                      }
                      
                      if (attempts > 30) {
                        clearInterval(pollInterval); // Give up after 30 attempts (~15 mins)
                        setIsVideoGenerating(false);
                        setGenerationProgress("Video Generation Timed Out.");
                      }
                    }, 30000); // Poll every 30 seconds
                 }
              } else {
                setIsVideoGenerating(false);
                setGenerationProgress("Failed to start generation.");
              }
            }).catch(e => {
                setIsVideoGenerating(false);
                setGenerationProgress(`Error: ${e.message}`);
            });
            
            // We must reply to Gemini letting it know we received the tool call, otherwise it hangs
            const functionResponseMsg = {
              toolResponse: {
                functionResponses: [{
                  id: call.id,
                  name: call.name,
                  response: { status: "video generation started, notify the user it will take a few minutes." }
                }]
              }
            };
            ws.send(JSON.stringify(functionResponseMsg));
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

  return { isConnected, isSetupComplete, connect, disconnect, sendFrame, messages, generatedVideoUrl, isVideoGenerating, generationProgress };
}
