import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types/kraken.types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  playerId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  playerId,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="kraken-chat-panel">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.isSystem ? 'system' : ''} ${msg.playerId === playerId ? 'mine' : ''}`}
          >
            {!msg.isSystem && (
              <span className="chat-sender">{msg.playerName}: </span>
            )}
            <span className={`chat-text ${msg.isSystem ? 'system-text' : ''}`}>
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="메시지 입력..."
          className="chat-input"
        />
        <button onClick={handleSend} className="chat-send-btn">
          전송
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
