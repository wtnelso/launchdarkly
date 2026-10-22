import { useEffect, useRef, useState } from 'react';
import { SiteFooter, SiteNav } from '../../components/SiteNav';
import { applyPersonaContext, usePersona } from '../part2/personaStore';
import { rateMessage, resetChat, sendMessage, useChat, type ChatMessage } from './chatStore';

const SUGGESTIONS = ['Where is my invoice?', 'I forgot my password', 'What is my API rate limit?', 'Export a report to CSV'];

export function Part4View() {
  const persona = usePersona();
  const chat = useChat();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void applyPersonaContext();
  }, []);

  useEffect(() => {
    resetChat();
  }, [persona.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages.length, chat.pending]);

  const submit = (text: string) => {
    setDraft('');
    void sendMessage(text);
  };

  return (
    <div className="landing help">
      <SiteNav active="Help Center" />

      <section className="help-head">
        <p className="eyebrow">Help Center</p>
        <h1>How can we help{persona.user.anonymous ? '' : `, ${persona.user.name?.split(' ')[0]}`}?</h1>
        <p className="lede muted">Ask the assistant about billing, sign-in, API limits or exports. A person is one message away if it can't help.</p>
      </section>

      <section className="chat" aria-label="Support assistant">
        <div className="chat-head">
          <span className="chat-title">
            <span className={`dot ${chat.disabled ? 'off' : 'on'}`} /> Support assistant
          </span>
          <span className="small muted">{chat.disabled ? 'offline' : 'online · usually replies in seconds'}</span>
        </div>

        <div className="chat-log" ref={logRef}>
          {chat.messages.length === 0 && !chat.disabled && (
            <div className="msg assistant">
              <div className="bubble">Hi! I'm the ABC Analytics assistant. What can I help you with today?</div>
            </div>
          )}
          {chat.messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}
          {chat.pending && (
            <div className="msg assistant">
              <div className="bubble typing" aria-label="Assistant is typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          {chat.disabled && (
            <div className="chat-banner">
              The assistant is taking a break right now. Email <a href="mailto:support@abc.example">support@abc.example</a> and we'll
              get back to you within a business day.
            </div>
          )}
          {chat.error && <p className="small error">{chat.error}</p>}
        </div>

        <div className="chips" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => submit(s)} disabled={chat.pending || chat.disabled}>
              {s}
            </button>
          ))}
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={chat.disabled ? 'The assistant is unavailable' : 'Type your question…'}
            maxLength={500}
            disabled={chat.pending || chat.disabled}
            aria-label="Your question"
          />
          <button className="btn btn-primary" type="submit" disabled={chat.pending || chat.disabled || !draft.trim()}>
            Send
          </button>
        </form>
      </section>

      <SiteFooter />
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const turn = message.turn;
  return (
    <div className={`msg ${message.role}`}>
      <div className="bubble">{message.content}</div>
      {turn && (
        <div className="feedback" aria-label="Was this helpful?">
          <button
            onClick={() => void rateMessage(message.id, 'positive')}
            disabled={Boolean(turn.feedback)}
            aria-pressed={turn.feedback === 'positive'}
            aria-label="Helpful"
            title="Helpful"
          >
            👍
          </button>
          <button
            onClick={() => void rateMessage(message.id, 'negative')}
            disabled={Boolean(turn.feedback)}
            aria-pressed={turn.feedback === 'negative'}
            aria-label="Not helpful"
            title="Not helpful"
          >
            👎
          </button>
          {turn.feedback && <span className="small muted">Thanks for the feedback</span>}
        </div>
      )}
    </div>
  );
}
