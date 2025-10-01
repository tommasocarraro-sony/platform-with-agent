import { useState, useEffect, useCallback } from "react";
import { Bot, X, Mic, Square } from "lucide-react";
import { useMovieContext } from "./MovieContext";
import { useAuth } from './AuthContext';

export default function AgentChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, text: "👋 Hi! How can I help you search movies?", type: "bot" }
  ]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const { setRecommendedMovieIds } = useMovieContext();

  // Function to extract movie IDs from tool response
  const extractMovieIdsFromTool = (apiResponse) => {
    if (!apiResponse.messages || !Array.isArray(apiResponse.messages)) {
      return null;
    }

    const toolMessages = apiResponse.messages.filter(msg =>
      msg.type === "tool" && msg.name === "get_top_k_recommendations_tool"
    );

    if (toolMessages.length === 0) {
      return null;
    }

    const lastToolMessage = toolMessages[toolMessages.length - 1];

    try {
      const content = lastToolMessage.content.replace(/^"|"$/g, '').replace(/\\/g, '');
      const parsedContent = JSON.parse(content);

      if (parsedContent.data && Array.isArray(parsedContent.data)) {
        return parsedContent.data.map(id => parseInt(id));
      }
    } catch (error) {
      console.error('Error parsing tool message:', error);
    }

    return null;
  };

  // Function to extract the final AI message from the response
  const extractFinalAIMessage = (apiResponse) => {
    if (!apiResponse.messages || !Array.isArray(apiResponse.messages)) {
      return "Sorry, I couldn't process that request.";
    }

    const aiMessages = apiResponse.messages.filter(msg =>
      msg.type === "ai" && msg.content && msg.content.trim() !== ""
    );

    if (aiMessages.length === 0) {
      return "I'm still processing your request...";
    }

    const finalAIMessage = aiMessages[aiMessages.length - 1];
    return finalAIMessage.content;
  };

  // Wrap handleSend in useCallback to avoid infinite re-renders
  const handleSend = useCallback(async (textToSend = null) => {
    const messageText = textToSend || input;

    if (!messageText.trim() || loading) return;

    // Add user context to the query
    const queryWithUser = user ? `user ${user.id}: ${messageText}` : messageText;

    // Add user message
    const userMessage = { id: Date.now(), text: messageText, type: "user" };
    setMessages(prev => [...prev, userMessage]);

    const currentInput = queryWithUser;
    if (!textToSend) {
      setInput("");
    }
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/recommend?query=${encodeURIComponent(currentInput)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const movieIds = extractMovieIdsFromTool(data);
      if (movieIds && movieIds.length > 0) {
        setRecommendedMovieIds(movieIds);
      }

      const finalMessage = extractFinalAIMessage(data);
      const botMessage = {
        id: Date.now() + 1,
        text: finalMessage,
        type: "bot"
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error('Error calling recommend endpoint:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        type: "bot"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, setRecommendedMovieIds, user]);

  // Speech recognition setup
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setInput(finalTranscript + interimTranscript);
    };

    recognition.onend = () => {
      setListening(false);
      // Get the final transcript and send it immediately
      const finalInput = input.trim();
      if (finalInput && !loading) {
        console.log("Auto-sending message:", finalInput);
        handleSend(finalInput);
        setInput(""); // Clear input after sending
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };

    window.speechRecognition = recognition;
  }, [input, loading, handleSend]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Speech recognition controls
  const startListening = () => {
    if (window.speechRecognition && !listening) {
      setInput(""); // Clear input when starting to listen
      window.speechRecognition.start();
    }
  };

  const stopListening = () => {
    if (window.speechRecognition && listening) {
      window.speechRecognition.stop();
    }
  };

  const toggleListening = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const formatMessage = (text) => {
    return text.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  const isSpeechSupported = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform hover:scale-110"
        >
          <Bot size={28} />
        </button>
      )}

      {/* Chat dialog */}
      {open && (
        <div className="fixed bottom-0 right-6 w-96 bg-white rounded-t-2xl shadow-2xl overflow-hidden transform transition-transform duration-300">
          {/* Header */}
          <div className="flex justify-between items-center bg-blue-600 text-white px-4 py-2">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <span className="font-semibold">MovieLens Agent</span>
              {user && (
                <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">
                  User {user.id}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="h-64 p-4 overflow-y-auto text-sm text-gray-800">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-3 ${message.type === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-lg max-w-[80%] ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {formatMessage(message.text)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-left mb-3">
                <div className="inline-block px-3 py-2 rounded-lg bg-gray-200 text-gray-800">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Voice listening indicator */}
          {listening && (
            <div className="px-4 py-2 bg-red-100 border-t border-red-200">
              <div className="flex items-center gap-2 text-red-700">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm font-medium">Listening... Speak now</span>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-2 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={listening ? "Speak now..." : "Type your request..."}
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              disabled={loading}
            />

            {/* Microphone Button */}
            {isSpeechSupported && (
              <button
                onClick={toggleListening}
                disabled={loading}
                className={`p-2 rounded-lg transition-colors ${
                  listening 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
                title={listening ? "Stop listening" : "Start voice input"}
              >
                {listening ? <Square size={20} /> : <Mic size={20} />}
              </button>
            )}

            {/* Send Button */}
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>

          {/* Speech support warning */}
          {!isSpeechSupported && (
            <div className="px-4 py-1 bg-yellow-100 text-yellow-700 text-xs text-center">
              Voice input not supported in this browser
            </div>
          )}
        </div>
      )}
    </>
  );
}