import { Bot, Check, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sendMainframeChatMessage } from '../services/mainframeApi.js';

const minimumThinkingMs = 1800;
const typingDelayMs = 18;
const typingChunkSize = 5;

const initialMessages = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Здравей, аз съм Mainframe4o. С какво мога да ти бъда полезен? Мога да ти предложа примерна конфигурация или да сравня модулите за теб. Само кажи.',
  },
];

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createMessageId(role) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isApplyConfirmation(text) {
  return /^(да|ок|окей|добре|съгласен|съгласна|съгласни|приложи|избери|yes|apply)\b/i.test(text.trim());
}

export function MainframeChat({ onApplySelection, selection }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [isApplyingSelection, setIsApplyingSelection] = useState(false);
  const chatLogRef = useRef(null);
  const typingSequenceRef = useRef(0);

  const isTyping = useMemo(() => messages.some((message) => message.isTyping), [messages]);
  const canSend = useMemo(
    () => draft.trim().length > 0 && !isSending && !isTyping && !isApplyingSelection,
    [draft, isApplyingSelection, isSending, isTyping],
  );

  useEffect(() => {
    const chatLog = chatLogRef.current;

    if (!chatLog) {
      return;
    }

    chatLog.scrollTop = chatLog.scrollHeight;
  }, [messages, isSending, error]);

  const revealAssistantMessage = async ({ model, reply, suggestedSelection }) => {
    const text = reply || 'Няма върнат отговор.';
    const messageId = createMessageId('assistant');
    const sequence = typingSequenceRef.current + 1;

    typingSequenceRef.current = sequence;
    setMessages((current) => [
      ...current,
      {
        id: messageId,
        role: 'assistant',
        content: '',
        model,
        suggestedSelection,
        isTyping: true,
      },
    ]);

    for (let visibleChars = typingChunkSize; visibleChars < text.length; visibleChars += typingChunkSize) {
      await wait(typingDelayMs);

      if (typingSequenceRef.current !== sequence) {
        return;
      }

      setMessages((current) => current.map((message) => (
        message.id === messageId
          ? { ...message, content: text.slice(0, visibleChars), isTyping: true }
          : message
      )));
    }

    setMessages((current) => current.map((message) => (
      message.id === messageId
        ? { ...message, content: text, isTyping: false }
        : message
    )));
  };

  const applySuggestedSelection = async (suggestedSelection, includeUserMessage = false) => {
    if (!suggestedSelection) {
      return;
    }

    setIsApplyingSelection(true);
    setPendingSuggestion(null);

    if (includeUserMessage) {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId('user'),
          role: 'user',
          content: 'Да, моля приложи тази конфигурация.',
        },
      ]);
    }

    try {
      await onApplySelection(suggestedSelection);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId('assistant'),
          role: 'assistant',
          content: 'Готово. Приложих предложената конфигурация в конфигуратора.',
          appliedSelection: suggestedSelection,
        },
      ]);
    } finally {
      setIsApplyingSelection(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    const userMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: draft.trim(),
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft('');
    setIsSending(true);
    setError('');

    if (pendingSuggestion && isApplyConfirmation(userMessage.content)) {
      setIsSending(false);
      await applySuggestedSelection(pendingSuggestion);
      return;
    }

    try {
      const startedAt = window.performance.now();
      const result = await sendMainframeChatMessage({
        messages: nextMessages,
        selection,
      });
      const suggestedSelection = result.suggestedSelection ?? null;
      const remainingThinkingMs = minimumThinkingMs - (window.performance.now() - startedAt);

      if (remainingThinkingMs > 0) {
        await wait(remainingThinkingMs);
      }

      setPendingSuggestion(suggestedSelection);
      setIsSending(false);
      await revealAssistantMessage({
        model: result.model,
        reply: result.reply,
        suggestedSelection,
      });
    } catch {
      setError('Mainframe4o не върна отговор. Провери дали backend-ът и Ollama работят.');
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
        <small>local Qwen3</small>
      </div>

      <div className="chat-log" aria-live="polite" ref={chatLogRef}>
        {messages.map((message, index) => (
          <article className={`chat-message ${message.role}`} key={message.id ?? `${message.role}-${index}`}>
            <span>{message.role === 'assistant' ? 'Mainframe4o' : 'Вие'}</span>
            <div>{message.content}</div>
            {message.suggestedSelection && !message.isTyping && (
              <div className="chat-actions">
                <button
                  className="chat-apply-button"
                  disabled={isApplyingSelection}
                  onClick={() => applySuggestedSelection(message.suggestedSelection, true)}
                  type="button"
                >
                  <Check size={16} />
                  {isApplyingSelection ? 'Прилагам...' : 'Приложи конфигурацията'}
                </button>
              </div>
            )}
          </article>
        ))}
        {isSending && (
          <article className="chat-message assistant pending">
            <span>Mainframe4o</span>
            Mainframe4o мисли...
          </article>
        )}
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form className="chat-form" onSubmit={sendMessage}>
        <textarea
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Пример: Банка, висока натовареност, бюджет 2 млн. евро, приоритети: сигурност и транзакции."
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
