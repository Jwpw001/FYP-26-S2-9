import React, { useState, useRef, useEffect } from 'react';
import Button from '../components/Button';

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    content:
      'Hi! I can answer questions about your workforce data — understaffed shifts, pending requests, workload distribution, and recommendation rationale. What would you like to know?',
  },
  {
    role: 'user',
    content: 'Which shifts this week are still understaffed?',
  },
  {
    role: 'assistant',
    content:
      'You have 3 unfilled roles this week:\n\n• Sat 15 Jun · Morning — 1 Floor Crew unfilled\n• Sun 16 Jun · Afternoon — 2 roles unfilled (Cashier + Kitchen)\n• Sun 16 Jun · Evening — 1 Floor Crew unfilled\n\nSunday afternoon is your most critical gap. Would you like me to explain why availability is low that day?',
  },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const msgsRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput('');
    const updated = [...messages, { role: 'user', content: q }];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          system:
            'You are the Krewby AI Workforce Assistant embedded in a workforce scheduling app called Krewby. ' +
            'Answer questions about staff scheduling, shift coverage, leave requests, workload balance, and smart recommendations. ' +
            'Keep answers concise and practical. You are read-only — you cannot modify any records. ' +
            'Use bullet points for lists. The outlet is a retail/F&B outlet in Singapore.',
          messages: updated.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      const reply =
        data.content?.map((c) => c.text || '').join('') ||
        'Sorry, I could not process that request.';

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I had trouble connecting. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) sendMessage();
  };

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 28,
            height: 28,
            background: 'var(--purple)',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i
            className="ti ti-message-bolt"
            style={{ fontSize: 15, color: 'var(--purple-t)' }}
            aria-hidden="true"
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>AI Workforce Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Read-only · Cannot modify records
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-wrap">
        <div className="chat-msgs" ref={msgsRef}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{ alignSelf: msg.role === 'assistant' ? 'flex-start' : 'flex-end' }}
            >
              {msg.role === 'assistant' && (
                <div className="msg-lbl">Krewby AI</div>
              )}
              <div
                className={`msg msg-${msg.role === 'assistant' ? 'ai' : 'user'}`}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start' }}>
              <div className="msg-lbl">Krewby AI</div>
              <div className="msg msg-ai" style={{ color: 'var(--muted)' }}>
                Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="Ask about your workforce data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <Button
            variant="primary"
            className="btn-sm"
            onClick={sendMessage}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            <i className="ti ti-send" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
