import { Bot, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { sendMainframeChatMessage } from '../services/mainframeApi.js';

const initialMessages = [
  {
    role: 'assistant',
    content:
      'Здравей, аз съм Mainframe4o. Можеш да ми кажеш тип фирма, натоварване, бюджет и приоритети, а аз ще предложа конфигурация от наличните модули.',
  },
];

export function MainframeChat({ selection }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const canSend = useMemo(() => draft.trim().length > 0 && !isSending, [draft, isSending]);

  const sendMessage = async (event) => {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    const userMessage = {
      role: 'user',
      content: draft.trim(),
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft('');
    setIsSending(true);
    setError('');

    try {
      const result = await sendMainframeChatMessage({
        messages: nextMessages,
        selection,
      });

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.reply || 'Няма върнат отговор.',
          model: result.model,
        },
      ]);
    } catch {
      setError('Mainframe4o не върна отговор. Провери дали backend-ът и Ollama/Mistral работят.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="chat-panel">
      <div className="chat-head">
        <span>
          <Bot size={18} />
          Mainframe4o
        </span>
        <small>local Mistral</small>
      </div>

      <div className="chat-log" aria-live="polite">
        {messages.map((message, index) => (
          <p className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <span>{message.role === 'assistant' ? 'Mainframe4o' : 'Вие'}</span>
            {message.content}
          </p>
        ))}
        {isSending && (
          <p className="chat-message assistant pending">
            <span>Mainframe4o</span>
            Мисля върху конфигурацията...
          </p>
        )}
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form className="chat-form" onSubmit={sendMessage}>
        <textarea
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Пример: Работя в банка, бюджетът е 2 млн. евро, трябват ми сигурност и много транзакции."
          rows={3}
          value={draft}
        />
        <button disabled={!canSend} type="submit">
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
